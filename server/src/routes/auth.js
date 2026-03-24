const express = require('express');
const bcrypt = require('bcryptjs');
const { UserRepository, LogRepository } = require('../repository');
const { authenticateToken, generateToken } = require('../middlewares/auth');

const router = express.Router();

// 检查用户有效期
function checkUserValidity(user) {
  // 检查状态
  if (user.status === 0) {
    return { valid: false, message: '账号已被禁用，请联系管理员' };
  }

  // 检查有效期
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

  if (user.valid_from && today < user.valid_from) {
    return { valid: false, message: '账号尚未生效，生效日期：' + user.valid_from };
  }

  if (user.valid_until && today > user.valid_until) {
    return { valid: false, message: '账号已过期，失效日期：' + user.valid_until };
  }

  return { valid: true };
}

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    const user = UserRepository.findByUsername(username);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 检查用户状态和有效期
    const validity = checkUserValidity(user);
    if (!validity.valid) {
      return res.status(403).json({
        success: false,
        message: validity.message
      });
    }

    const token = generateToken(user.id);

    // 记录登录日志
    LogRepository.create(user.id, 'login', 'user', user.id, '用户登录', req.ip);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});

// 登出
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    LogRepository.create(req.user.id, 'logout', 'user', req.user.id, '用户登出', req.ip);
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      message: '登出失败'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

module.exports = router;