const express = require('express');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { StatsRepository, getEmbeddingDimension, setEmbeddingDimension, createVectorsTable, getVectorsTableDimension, ImageRepository } = require('../repository');
const { getAIConfig, getEmbedding } = require('../services/aiService');
const { addImageVector, buildEmbeddingText } = require('../services/vectorService');
const { getStorage } = require('../services/storage');

const router = express.Router();

// 重建向量任务状态
let rebuildTask = {
  running: false,
  stopped: false,
  progress: 0,
  total: 0,
  current: 0,
  message: ''
};

// 获取系统配置信息
router.get('/config', authenticateToken, requireAdmin, (req, res) => {
  try {
    const aiConfig = getAIConfig();

    const config = {
      server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development'
      },
      database: {
        type: 'postgresql',
        host: process.env.PG_HOST || 'localhost',
        port: process.env.PG_PORT || 5432,
        database: process.env.PG_DATABASE || 'image_asset'
      },
      jwt: {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
        maxFiles: parseInt(process.env.MAX_FILES) || 100,
        uploadConcurrency: parseInt(process.env.UPLOAD_CONCURRENCY) || 5,
        allowedFormats: process.env.ALLOWED_FORMATS || 'jpg,jpeg,png,webp,gif,svg'
      },
      thumbnail: {
        size: parseInt(process.env.THUMBNAIL_SIZE) || 400,
        quality: parseInt(process.env.THUMBNAIL_QUALITY) || 80
      },
      ai: aiConfig,
      vector: {
        dimension: getEmbeddingDimension(),
        dbDimension: null // 将在下面异步获取
      }
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取系统配置错误:', error);
    res.status(500).json({
      success: false,
      message: '获取系统配置失败'
    });
  }
});

// 获取系统统计数据
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await StatsRepository.getSystemStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取系统统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取系统统计失败'
    });
  }
});

// 获取用户排名
router.get('/user-ranking', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const ranking = await StatsRepository.getUserRanking(limit);

    res.json({
      success: true,
      data: ranking
    });
  } catch (error) {
    console.error('获取用户排名错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户排名失败'
    });
  }
});

// 获取向量维度信息
router.get('/vector-dimension', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const aiConfig = getAIConfig();
    const dbDimension = await getVectorsTableDimension();

    res.json({
      success: true,
      data: {
        configuredDimension: getEmbeddingDimension(),
        aiProviderDimension: aiConfig.embeddingDimension,
        dbDimension: dbDimension,
        match: dbDimension === aiConfig.embeddingDimension
      }
    });
  } catch (error) {
    console.error('获取向量维度信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取向量维度信息失败'
    });
  }
});

// 重建向量表（需要管理员权限）
router.post('/rebuild-vectors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dimension } = req.body;
    const aiConfig = getAIConfig();
    const targetDimension = dimension || aiConfig.embeddingDimension;

    // 重建向量表
    await createVectorsTable(targetDimension);
    setEmbeddingDimension(targetDimension);

    res.json({
      success: true,
      message: `向量表已重建，维度: ${targetDimension}`,
      data: {
        dimension: targetDimension
      }
    });
  } catch (error) {
    console.error('重建向量表错误:', error);
    res.status(500).json({
      success: false,
      message: '重建向量表失败: ' + error.message
    });
  }
});

// 检查数据库连接
router.get('/db-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { pool } = require('../models/database-pg');
    const result = await pool.query('SELECT NOW() as time, version() as version');

    res.json({
      success: true,
      data: {
        connected: true,
        time: result.rows[0].time,
        version: result.rows[0].version
      }
    });
  } catch (error) {
    console.error('检查数据库连接错误:', error);
    res.status(500).json({
      success: false,
      message: '数据库连接失败',
      data: {
        connected: false
      }
    });
  }
});

module.exports = router;

// 重建向量进度查询
router.get('/rebuild-progress', authenticateToken, requireAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      running: rebuildTask.running,
      progress: rebuildTask.progress,
      total: rebuildTask.total,
      current: rebuildTask.current,
      message: rebuildTask.message
    }
  });
});

// 停止重建向量任务
router.post('/stop-rebuild', authenticateToken, requireAdmin, (req, res) => {
  if (rebuildTask.running) {
    rebuildTask.stopped = true;
    res.json({
      success: true,
      message: '已发送停止信号'
    });
  } else {
    res.json({
      success: false,
      message: '没有正在运行的重建任务'
    });
  }
});

// 重建所有图片向量（SSE）
router.post('/rebuild-all-vectors', authenticateToken, requireAdmin, async (req, res) => {
  // 检查是否已有任务在运行
  if (rebuildTask.running) {
    return res.status(400).json({
      success: false,
      message: '已有重建任务在运行中'
    });
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendProgress = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // 初始化任务状态
    rebuildTask = {
      running: true,
      stopped: false,
      progress: 0,
      total: 0,
      current: 0,
      message: '正在初始化...'
    };

    sendProgress({ type: 'start', message: '开始重建向量...' });

    // 获取所有图片
    const images = await ImageRepository.findAllDescriptions();
    rebuildTask.total = images.length;

    sendProgress({
      type: 'info',
      message: `找到 ${images.length} 张图片需要重建向量`
    });

    if (images.length === 0) {
      rebuildTask.running = false;
      sendProgress({ type: 'done', message: '没有需要处理的图片' });
      res.end();
      return;
    }

    const storage = getStorage();
    let processed = 0;
    let success = 0;
    let failed = 0;

    for (const image of images) {
      // 检查是否被停止
      if (rebuildTask.stopped) {
        rebuildTask.running = false;
        sendProgress({
          type: 'stopped',
          message: `任务已停止，已处理 ${processed}/${images.length}，成功 ${success}，失败 ${failed}`
        });
        res.end();
        return;
      }

      processed++;
      rebuildTask.current = processed;
      rebuildTask.progress = Math.round((processed / images.length) * 100);
      rebuildTask.message = `处理中 ${processed}/${images.length}`;

      sendProgress({
        type: 'progress',
        current: processed,
        total: images.length,
        progress: rebuildTask.progress,
        imageId: image.id
      });

      try {
        // 获取图片文件
        const fullImage = await ImageRepository.findById(image.id);
        if (!fullImage) {
          failed++;
          sendProgress({ type: 'skip', imageId: image.id, reason: '图片不存在' });
          continue;
        }

        // 检查文件是否存在
        const exists = await storage.exists(fullImage.file_path);
        if (!exists) {
          failed++;
          sendProgress({ type: 'skip', imageId: image.id, reason: '文件不存在' });
          continue;
        }

        // 构建向量化文本
        const text = buildEmbeddingText(image.description, image.extracted_text);

        // 获取向量
        const embedding = await getEmbedding(text);

        // 保存向量
        await addImageVector(image.id, embedding, fullImage.uploaded_by);

        success++;
      } catch (error) {
        failed++;
        sendProgress({ type: 'error', imageId: image.id, error: error.message });
      }

      // 短暂延迟，避免过载
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    rebuildTask.running = false;
    sendProgress({
      type: 'done',
      message: `重建完成，成功 ${success}，失败 ${failed}`,
      success,
      failed,
      total: images.length
    });

    res.end();
  } catch (error) {
    rebuildTask.running = false;
    console.error('重建向量失败:', error);
    sendProgress({ type: 'error', message: error.message });
    res.end();
  }
});