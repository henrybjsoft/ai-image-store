const express = require('express');
const bcrypt = require('bcryptjs');
const { UserRepository, LogRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 所有用户路由都需要认证
router.use(authenticateToken);

// 获取用户列表
router.get('/', (req, res) => {
  try {
    const users = UserRepository.findAll();

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
});

// 创建用户
router.post('/', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        success: false,
        message: '用户名长度应在3-50个字符之间'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少6个字符'
      });
    }

    // 检查用户名是否已存在
    if (UserRepository.isUsernameTaken(username)) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = UserRepository.create(username, passwordHash);

    LogRepository.create(req.user.id, 'create_user', 'user', user.id, `创建用户: ${username}`, req.ip);

    res.json({
      success: true,
      message: '用户创建成功',
      data: user
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({
      success: false,
      message: '创建用户失败'
    });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    // 检查用户是否存在
    const user = UserRepository.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查用户名是否被其他用户占用
    if (UserRepository.isUsernameTaken(username, id)) {
      return res.status(400).json({
        success: false,
        message: '用户名已被使用'
      });
    }

    UserRepository.updateUsername(id, username);

    LogRepository.create(req.user.id, 'update_user', 'user', id, `更新用户名: ${username}`, req.ip);

    res.json({
      success: true,
      message: '用户信息更新成功'
    });
  } catch (error) {
    console.error('更新用户错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户失败'
    });
  }
});

// 修改密码
router.put('/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: '密码长度至少6个字符'
      });
    }

    // 检查用户是否存在
    const user = UserRepository.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    UserRepository.updatePassword(id, passwordHash);

    LogRepository.create(req.user.id, 'change_password', 'user', id, `修改用户密码: ${user.username}`, req.ip);

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      message: '修改密码失败'
    });
  }
});

// 删除用户
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账号'
      });
    }

    const user = UserRepository.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    UserRepository.delete(id);

    LogRepository.create(req.user.id, 'delete_user', 'user', id, `删除用户: ${user.username}`, req.ip);

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
});

module.exports = router;