const express = require('express');
const { FavoriteRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 所有收藏路由都需要认证
router.use(authenticateToken);

// 获取用户收藏列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;

    const result = await FavoriteRepository.findByUser(req.user.id, { page, pageSize });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取收藏列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏列表失败'
    });
  }
});

// 获取用户收藏数量
router.get('/count', async (req, res) => {
  try {
    const count = await FavoriteRepository.countByUser(req.user.id);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('获取收藏数量错误:', error);
    res.status(500).json({
      success: false,
      message: '获取收藏数量失败'
    });
  }
});

module.exports = router;