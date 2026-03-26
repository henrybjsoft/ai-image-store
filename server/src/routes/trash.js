const express = require('express');
const { ImageRepository, LogRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');
const { removeImageVector } = require('../services/vectorService');
const { getStorage } = require('../services/storage');

const router = express.Router();

// 所有回收站路由都需要认证
router.use(authenticateToken);

// 获取回收站列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const result = await ImageRepository.findList({
      isDeleted: 1,
      page,
      pageSize,
      sortBy: 'deleted_at',
      sortOrder: 'DESC'
    });

    res.json({
      success: true,
      data: result
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

    await ImageRepository.restore(ids);

    await LogRepository.create(req.user.id, 'restore_images', 'image', null, `恢复 ${ids.length} 张图片`, req.ip);

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

    const image = await ImageRepository.findById(id);
    if (!image || !image.is_deleted) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const storage = getStorage();

    // 删除文件
    let fileDeleted = true;
    try {
      if (await storage.exists(image.file_path)) {
        await storage.delete(image.file_path);
      }
    } catch (e) {
      fileDeleted = false;
      console.warn('删除文件失败:', e.message);
    }

    // 删除缩略图
    if (image.thumbnail_path) {
      try {
        if (await storage.exists(image.thumbnail_path)) {
          await storage.delete(image.thumbnail_path);
        }
      } catch (e) {
        console.warn('删除缩略图失败:', e.message);
      }
    }

    // 删除数据库记录
    await ImageRepository.hardDelete(id);

    // 删除向量
    await removeImageVector(id);

    await LogRepository.create(req.user.id, 'permanent_delete_image', 'image', id, `彻底删除图片: ${image.original_name}`, req.ip);

    if (!fileDeleted) {
      return res.json({
        success: true,
        message: '图片记录已删除，但文件被占用未能删除'
      });
    }

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
    // 获取所有已删除图片
    const deletedImages = await ImageRepository.findDeleted();

    let deletedCount = 0;
    let failedFiles = [];
    const storage = getStorage();

    // 删除文件
    for (const image of deletedImages) {
      try {
        // 删除原图
        if (await storage.exists(image.file_path)) {
          await storage.delete(image.file_path);
        }
        // 删除缩略图
        if (image.thumbnail_path && await storage.exists(image.thumbnail_path)) {
          await storage.delete(image.thumbnail_path);
        }
        // 删除向量
        await removeImageVector(image.id);
        deletedCount++;
      } catch (fileError) {
        // 文件被占用时跳过，记录失败文件
        console.warn(`删除文件失败: ${image.file_path}`, fileError.message);
        failedFiles.push(image.original_name);
      }
    }

    // 清空回收站（只删除成功删除文件的数据库记录）
    if (deletedCount > 0) {
      await ImageRepository.emptyTrash();
    }

    await LogRepository.create(req.user.id, 'empty_trash', 'image', null, `清空回收站，删除 ${deletedCount} 张图片`, req.ip);

    if (failedFiles.length > 0) {
      res.json({
        success: true,
        message: `已删除 ${deletedCount} 张图片，${failedFiles.length} 张文件被占用无法删除`,
        failedFiles
      });
    } else {
      res.json({
        success: true,
        message: `已清空回收站，删除 ${deletedCount} 张图片`
      });
    }
  } catch (error) {
    console.error('清空回收站错误:', error);
    res.status(500).json({
      success: false,
      message: '清空回收站失败'
    });
  }
});

module.exports = router;