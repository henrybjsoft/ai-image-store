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

    // 验证用户是否存在
    const db = getDatabase();
    const userRecord = db.prepare('SELECT id, username FROM users WHERE id = ?').get(user.userId);

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

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
  authenticateToken,
  generateToken
};