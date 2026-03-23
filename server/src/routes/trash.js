const express = require('express');
const fs = require('fs');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middlewares/auth');
const { logAction } = require('../services/logService');
const { removeImageVector } = require('../services/vectorService');

const router = express.Router();

// 所有回收站路由都需要认证
router.use(authenticateToken);

// 获取回收站列表
router.get('/', (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const db = getDatabase();

    // 计算总数
    const totalResult = db.prepare('SELECT COUNT(*) as total FROM images WHERE is_deleted = 1').get();
    const total = totalResult.total;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as deleter_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 1
      ORDER BY i.deleted_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: images,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取回收站列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取回收站列表失败'
    });
  }
});

// 恢复图片
router.post('/restore', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要恢复的图片'
      });
    }

    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');

    db.prepare(`
      UPDATE images SET is_deleted = 0, deleted_at = NULL
      WHERE id IN (${placeholders}) AND is_deleted = 1
    `).run(...ids);

    await logAction(req.user.id, 'restore_images', 'image', null, `恢复 ${ids.length} 张图片`, req.ip);

    res.json({
      success: true,
      message: `已恢复 ${ids.length} 张图片`
    });
  } catch (error) {
    console.error('恢复图片错误:', error);
    res.status(500).json({
      success: false,
      message: '恢复图片失败'
    });
  }
});

// 彻底删除单张图片
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 1').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 删除文件
    if (fs.existsSync(image.file_path)) {
      fs.unlinkSync(image.file_path);
    }
    if (image.thumbnail_path && fs.existsSync(image.thumbnail_path)) {
      fs.unlinkSync(image.thumbnail_path);
    }

    // 删除数据库记录
    db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(id);
    db.prepare('DELETE FROM images WHERE id = ?').run(id);

    // 删除向量
    removeImageVector(id);

    await logAction(req.user.id, 'permanent_delete_image', 'image', id, `彻底删除图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '图片已彻底删除'
    });
  } catch (error) {
    console.error('彻底删除图片错误:', error);
    res.status(500).json({
      success: false,
      message: '彻底删除图片失败'
    });
  }
});

// 清空回收站
router.delete('/', async (req, res) => {
  try {
    const db = getDatabase();

    // 获取所有已删除图片
    const images = db.prepare('SELECT * FROM images WHERE is_deleted = 1').all();

    // 删除文件
    for (const image of images) {
      if (fs.existsSync(image.file_path)) {
        fs.unlinkSync(image.file_path);
      }
      if (image.thumbnail_path && fs.existsSync(image.thumbnail_path)) {
        fs.unlinkSync(image.thumbnail_path);
      }
      removeImageVector(image.id);
    }

    // 删除数据库记录
    const imageIds = images.map(i => i.id);
    if (imageIds.length > 0) {
      const placeholders = imageIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...imageIds);
      db.prepare(`DELETE FROM images WHERE is_deleted = 1`).run();
    }

    await logAction(req.user.id, 'empty_trash', 'image', null, `清空回收站，删除 ${images.length} 张图片`, req.ip);

    res.json({
      success: true,
      message: `已清空回收站，删除 ${images.length} 张图片`
    });
  } catch (error) {
    console.error('清空回收站错误:', error);
    res.status(500).json({
      success: false,
      message: '清空回收站失败'
    });
  }
});

module.exports = router;