const express = require('express');
const { getLogs, getLogCount } = require('../services/logService');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 所有日志路由都需要认证
router.use(authenticateToken);

// 获取操作日志列表
router.get('/', (req, res) => {
  try {
    const { userId, action, startDate, endDate, page = 1, pageSize = 20 } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    filters.limit = parseInt(pageSize);
    filters.offset = offset;

    const logs = getLogs(filters);
    const total = getLogCount(filters);

    res.json({
      success: true,
      data: {
        list: logs,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取日志错误:', error);
    res.status(500).json({
      success: false,
      message: '获取日志失败'
    });
  }
});

module.exports = router;