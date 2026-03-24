const express = require('express');
const bcrypt = require('bcryptjs');
const { UserRepository, LogRepository } = require('../repository');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// 所有用户路由都需要认证
router.use(authenticateToken);

// 获取当前用户配额信息
router.get('/quota', (req, res) => {
  try {
    const user = UserRepository.findById(req.user.id);
    const imageCount = UserRepository.getImageCount(req.user.id);

    res.json({
      success: true,
      data: {
        quota: user.quota || 0,
        imageCount,
        role: user.role
      }
    });
  } catch (error) {
    console.error('获取配额信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取配额信息失败'
    });
  }
});

// 获取用户列表（仅管理员）
router.get('/', requireAdmin, (req, res) => {
  try {
    const users = UserRepository.findAll();

    // 为每个用户添加图片数量
    const usersWithCount = users.map(user => ({
      ...user,
      imageCount: UserRepository.getImageCount(user.id)
    }));

    res.json({
      success: true,
      data: usersWithCount
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
});

// 创建用户（仅管理员）
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, password, name, description, role, status, quota, validFrom, validUntil } = req.body;

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
    const user = UserRepository.create({
      username,
      passwordHash,
      name,
      description,
      role: role || 'user',
      status: status !== undefined ? status : 1,
      quota: quota !== undefined ? quota : 100,
      validFrom,
      validUntil
    });

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

// 更新用户信息（仅管理员）
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, name, description, role, status, quota, validFrom, validUntil } = req.body;

    // 检查用户是否存在
    const user = UserRepository.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // admin 用户特殊处理
    if (user.username === 'admin') {
      // admin 用户只能修改名称和说明
      if (username && username !== 'admin') {
        return res.status(400).json({
          success: false,
          message: 'admin 用户名不可修改'
        });
      }
      UserRepository.updateNameAndDescription(id, name, description);
      LogRepository.create(req.user.id, 'update_user', 'user', id, `更新admin用户信息`, req.ip);
      return res.json({
        success: true,
        message: '用户信息更新成功'
      });
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        message: '用户名不能为空'
      });
    }

    // 检查用户名是否被其他用户占用
    if (UserRepository.isUsernameTaken(username, id)) {
      return res.status(400).json({
        success: false,
        message: '用户名已被使用'
      });
    }

    UserRepository.update(id, {
      username,
      name,
      description,
      role: role || 'user',
      status: status !== undefined ? status : 1,
      quota: quota !== undefined ? quota : 100,
      validFrom,
      validUntil
    });

    LogRepository.create(req.user.id, 'update_user', 'user', id, `更新用户: ${username}`, req.ip);

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

// 修改当前用户密码（需验证旧密码）
router.put('/me/password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请输入旧密码和新密码'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度至少6个字符'
      });
    }

    // 获取当前用户
    const user = UserRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证旧密码
    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    UserRepository.updatePassword(req.user.id, passwordHash);

    LogRepository.create(req.user.id, 'change_password', 'user', req.user.id, `用户修改自己的密码`, req.ip);

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

// 修改密码（管理员重置其他用户密码）
router.put('/:id/password', requireAdmin, async (req, res) => {
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

    LogRepository.create(req.user.id, 'change_password', 'user', id, `重置用户密码: ${user.username}`, req.ip);

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

// 删除用户（仅管理员）
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // 不能删除admin用户
    const user = UserRepository.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (user.username === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'admin 用户不可删除'
      });
    }

    // 不能删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账号'
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