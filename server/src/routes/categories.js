const express = require('express');
const { CategoryRepository, ImageRepository, LogRepository } = require('../repository');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 获取分类树（公开）
router.get('/', async (req, res) => {
  try {
    const categoryTree = await CategoryRepository.getTree();

    res.json({
      success: true,
      data: categoryTree
    });
  } catch (error) {
    console.error('获取分类错误:', error);
    res.status(500).json({
      success: false,
      message: '获取分类失败'
    });
  }
});

// 以下路由需要认证
router.use(authenticateToken);

// 创建分类
router.post('/', async (req, res) => {
  try {
    const { name, parent_id } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '分类名称不能为空'
      });
    }

    // 如果有父分类，检查父分类是否存在
    if (parent_id) {
      const parent = await CategoryRepository.findById(parent_id);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: '父分类不存在'
        });
      }
      // 不能创建三级分类
      if (parent.parent_id) {
        return res.status(400).json({
          success: false,
          message: '最多支持两级分类'
        });
      }
    }

    const category = await CategoryRepository.create(name.trim(), parent_id || null);

    await LogRepository.create(req.user.id, 'create_category', 'category', category.id, `创建分类: ${name}`, req.ip);

    res.json({
      success: true,
      message: '分类创建成功',
      data: category
    });
  } catch (error) {
    console.error('创建分类错误:', error);
    res.status(500).json({
      success: false,
      message: '创建分类失败'
    });
  }
});

// 更新分类
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '分类名称不能为空'
      });
    }

    const category = await CategoryRepository.findById(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    await CategoryRepository.update(id, name.trim());

    await LogRepository.create(req.user.id, 'update_category', 'category', id, `更新分类名称: ${name}`, req.ip);

    res.json({
      success: true,
      message: '分类更新成功'
    });
  } catch (error) {
    console.error('更新分类错误:', error);
    res.status(500).json({
      success: false,
      message: '更新分类失败'
    });
  }
});

// 删除分类
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const category = await CategoryRepository.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    // 检查是否有子分类
    const childCount = await CategoryRepository.countChildren(id);
    if (childCount > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类下有子分类，请先删除子分类'
      });
    }

    // 检查是否有图片使用该分类
    const imageCount = await ImageRepository.countByCategory(id);
    if (imageCount > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类下有图片，请先移动或删除图片'
      });
    }

    await CategoryRepository.delete(id);

    await LogRepository.create(req.user.id, 'delete_category', 'category', id, `删除分类: ${category.name}`, req.ip);

    res.json({
      success: true,
      message: '分类删除成功'
    });
  } catch (error) {
    console.error('删除分类错误:', error);
    res.status(500).json({
      success: false,
      message: '删除分类失败'
    });
  }
});

module.exports = router;