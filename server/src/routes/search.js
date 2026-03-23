const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middlewares/auth');
const { getEmbedding } = require('../services/aiService');
const { searchSimilar } = require('../services/vectorService');

const router = express.Router();

// 关键字搜索
router.get('/keyword', authenticateToken, (req, res) => {
  try {
    const { q, page = 1, pageSize = 20 } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '搜索关键词不能为空'
      });
    }

    const db = getDatabase();
    const keyword = `%${q.trim()}%`;

    // 计算总数
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM images
      WHERE is_deleted = 0
      AND (original_name LIKE ? OR description LIKE ? OR keywords LIKE ?)
    `).get(keyword, keyword, keyword);

    const total = totalResult.total;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    // 搜索结果
    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0
      AND (i.original_name LIKE ? OR i.description LIKE ? OR i.keywords LIKE ?)
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(keyword, keyword, keyword, parseInt(pageSize), offset);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
      `).all(image.id);

      if (image.keywords) {
        try {
          image.keywords = JSON.parse(image.keywords);
        } catch (e) {
          image.keywords = [];
        }
      }
    }

    res.json({
      success: true,
      data: {
        list: images,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        keyword: q
      }
    });
  } catch (error) {
    console.error('关键字搜索错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

// 自然语言搜索（语义搜索）
router.post('/semantic', authenticateToken, async (req, res) => {
  try {
    const { query, page = 1, pageSize = 20 } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '搜索内容不能为空'
      });
    }

    // 获取查询文本的向量
    const embedding = await getEmbedding(query);

    // 搜索相似向量
    const similarities = searchSimilar(embedding, parseInt(pageSize) * 2);

    if (similarities.length === 0) {
      return res.json({
        success: true,
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          query
        }
      });
    }

    const db = getDatabase();
    const imageIds = similarities.map(s => s.imageId);

    // 获取图片详情
    const placeholders = imageIds.map(() => '?').join(',');
    let images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id IN (${placeholders}) AND i.is_deleted = 0
    `).all(...imageIds);

    // 按相似度排序
    const similarityMap = new Map(similarities.map(s => [s.imageId, s.distance]));
    images.sort((a, b) => {
      return (similarityMap.get(a.id) || Infinity) - (similarityMap.get(b.id) || Infinity);
    });

    // 分页
    const total = images.length;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    images = images.slice(offset, offset + parseInt(pageSize));

    // 获取每张图片的标签和相似度
    for (const image of images) {
      image.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
      `).all(image.id);

      image.similarity = similarityMap.get(image.id);

      if (image.keywords) {
        try {
          image.keywords = JSON.parse(image.keywords);
        } catch (e) {
          image.keywords = [];
        }
      }
    }

    res.json({
      success: true,
      data: {
        list: images,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        query
      }
    });
  } catch (error) {
    console.error('语义搜索错误:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败'
    });
  }
});

// 按标签筛选
router.get('/by-tag', authenticateToken, (req, res) => {
  try {
    const { tagId, page = 1, pageSize = 20 } = req.query;

    if (!tagId) {
      return res.status(400).json({
        success: false,
        message: '请选择标签'
      });
    }

    const db = getDatabase();

    // 计算总数
    const totalResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      WHERE i.is_deleted = 0 AND it.tag_id = ?
    `).get(tagId);

    const total = totalResult.total;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    // 获取图片
    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0 AND it.tag_id = ?
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(tagId, parseInt(pageSize), offset);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
      `).all(image.id);

      if (image.keywords) {
        try {
          image.keywords = JSON.parse(image.keywords);
        } catch (e) {
          image.keywords = [];
        }
      }
    }

    res.json({
      success: true,
      data: {
        list: images,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        tagId
      }
    });
  } catch (error) {
    console.error('标签筛选错误:', error);
    res.status(500).json({
      success: false,
      message: '筛选失败'
    });
  }
});

module.exports = router;