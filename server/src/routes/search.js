const express = require('express');
const { SearchRepository, ImageRepository, TagRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');
const { getEmbedding } = require('../services/aiService');
const { searchSimilar } = require('../services/vectorService');

const router = express.Router();

// 辅助函数：为图片添加标签信息
function enrichImagesWithTags(images) {
  for (const image of images) {
    image.tags = ImageRepository.getTags(image.id);

    if (image.keywords) {
      try {
        image.keywords = JSON.parse(image.keywords);
      } catch (e) {
        image.keywords = [];
      }
    }
  }
  return images;
}

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

    const result = SearchRepository.searchByKeyword(q.trim(), { page, pageSize });

    enrichImagesWithTags(result.list);

    res.json({
      success: true,
      data: {
        ...result,
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
    const { query, topK = 20, page = 1, pageSize = 20 } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '搜索内容不能为空'
      });
    }

    // 获取查询文本的向量
    const embedding = await getEmbedding(query);

    // 搜索相似向量，使用topK参数
    const similarities = searchSimilar(embedding, parseInt(topK));

    if (similarities.length === 0) {
      return res.json({
        success: true,
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          query,
          topK: parseInt(topK)
        }
      });
    }

    const imageIds = similarities.map(s => s.imageId);
    const similarityMap = new Map(similarities.map(s => [s.imageId, s.distance]));

    // 获取图片详情并按相似度排序
    let images = SearchRepository.findByIdsSorted(imageIds, similarityMap);

    // 获取每张图片的标签和相似度
    for (const image of images) {
      image.tags = ImageRepository.getTags(image.id);
      // distance 转换回 similarity：similarity = 1 - distance
      const distance = similarityMap.get(image.id);
      image.similarity = distance !== undefined ? 1 - distance : 0;

      if (image.keywords) {
        try {
          image.keywords = JSON.parse(image.keywords);
        } catch (e) {
          image.keywords = [];
        }
      }
    }

    // 返回所有结果（前端处理分页和筛选）
    res.json({
      success: true,
      data: {
        list: images.map(img => ({
          image: img,
          similarity: img.similarity
        })),
        total: images.length,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        query,
        topK: parseInt(topK)
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

    const result = TagRepository.findByTag(tagId, { page, pageSize });

    enrichImagesWithTags(result.list);

    res.json({
      success: true,
      data: {
        ...result,
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