const express = require('express');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { StatsRepository } = require('../repository');

const router = express.Router();

// 掩码敏感值（显示前4位和后4位，中间用*代替）
function maskSensitiveValue(value) {
  if (!value || typeof value !== 'string') return value;
  if (value.length <= 8) {
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
  }
  return value.substring(0, 4) + '****' + value.substring(value.length - 4);
}

// 获取系统配置信息
router.get('/config', authenticateToken, requireAdmin, (req, res) => {
  try {
    const config = {
      server: {
        port: process.env.PORT || 3000,
        nodeEnv: process.env.NODE_ENV || 'development'
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
      ai: {
        visionModel: process.env.AI_VISION_MODEL || 'qwen-vl-plus',
        embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-v3',
        apiKey: maskSensitiveValue(process.env.DASHSCOPE_API_KEY)
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
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const stats = StatsRepository.getSystemStats();

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
router.get('/user-ranking', authenticateToken, requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const ranking = StatsRepository.getUserRanking(limit);

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

module.exports = router;