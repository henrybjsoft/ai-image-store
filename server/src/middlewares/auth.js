const jwt = require('jsonwebtoken');
const { getDatabase } = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    // 验证用户是否存在，并获取完整信息
    const db = getDatabase();
    const userRecord = db.prepare('SELECT id, username, name, role, status FROM users WHERE id = ?').get(user.userId);

    if (!userRecord) {
      return res.status(403).json({
        success: false,
        message: '用户不存在'
      });
    }

    req.user = userRecord;
    next();
  });
}

// 要求管理员权限
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '权限不足，需要管理员权限'
    });
  }
  next();
}

function generateToken(userId) {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

module.exports = {
  authenticateToken,
  requireAdmin,
  generateToken
};