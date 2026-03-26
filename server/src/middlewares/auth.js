const jwt = require('jsonwebtoken');
const { UserRepository } = require('../repository');

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

  jwt.verify(token, JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }

    try {
      // 验证用户是否存在，并获取完整信息
      const userRecord = await UserRepository.findById(user.userId);

      if (!userRecord) {
        return res.status(403).json({
          success: false,
          message: '用户不存在'
        });
      }

      req.user = {
        id: userRecord.id,
        username: userRecord.username,
        name: userRecord.name,
        role: userRecord.role
      };
      next();
    } catch (error) {
      console.error('认证错误:', error);
      return res.status(500).json({
        success: false,
        message: '认证失败'
      });
    }
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