const express = require('express');
const { TagRepository, LogRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 获取所有标签（公开）
router.get('/', async (req, res) => {
  try {
    const tags = await TagRepository.findAll();

    res.json({
      success: true,
      data: tags
    });
  } catch (error) {
    console.error('获取标签错误:', error);
    res.status(500).json({
      success: false,
      message: '获取标签失败'
    });
  }
});

// 以下路由需要认证
router.use(authenticateToken);

// 创建标签
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '标签名称不能为空'
      });
    }

    // 检查标签是否已存在
    if (await TagRepository.findByName(name.trim())) {
      return res.status(400).json({
        success: false,
        message: '标签已存在'
      });
    }

    const tag = await TagRepository.create(name.trim());

    await LogRepository.create(req.user.id, 'create_tag', 'tag', tag.id, `创建标签: ${name}`, req.ip);

    res.json({
      success: true,
      message: '标签创建成功',
      data: tag
    });
  } catch (error) {
    console.error('创建标签错误:', error);
    res.status(500).json({
      success: false,
      message: '创建标签失败'
    });
  }
});

// 更新标签
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '标签名称不能为空'
      });
    }

    const tag = await TagRepository.findById(id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    // 检查标签名是否被占用
    if (await TagRepository.isNameTaken(name.trim(), id)) {
      return res.status(400).json({
        success: false,
        message: '标签名已被使用'
      });
    }

    await TagRepository.update(id, name.trim());

    await LogRepository.create(req.user.id, 'update_tag', 'tag', id, `更新标签: ${tag.name} -> ${name}`, req.ip);

    res.json({
      success: true,
      message: '标签更新成功'
    });
  } catch (error) {
    console.error('更新标签错误:', error);
    res.status(500).json({
      success: false,
      message: '更新标签失败'
    });
  }
});

// 删除标签
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tag = await TagRepository.findById(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    await TagRepository.delete(id);

    await LogRepository.create(req.user.id, 'delete_tag', 'tag', id, `删除标签: ${tag.name}`, req.ip);

    res.json({
      success: true,
      message: '标签删除成功'
    });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({
      success: false,
      message: '删除标签失败'
    });
  }
});

module.exports = router;