const express = require('express');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { StatsRepository, getEmbeddingDimension, setEmbeddingDimension, createVectorsTable, getVectorsTableDimension } = require('../repository');
const { getAIConfig, getProvider } = require('../services/aiService');

const router = express.Router();

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