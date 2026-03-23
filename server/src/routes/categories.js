const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middlewares/auth');
const { logAction } = require('../services/logService');

const router = express.Router();

// 获取分类树（公开）
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const categories = db.prepare('SELECT * FROM categories ORDER BY id').all();

    // 构建树形结构
    const categoryTree = [];
    const categoryMap = {};

    categories.forEach(cat => {
      categoryMap[cat.id] = {
        ...cat,
        children: []
      };
    });

    categories.forEach(cat => {
      if (cat.parent_id) {
        if (categoryMap[cat.parent_id]) {
          categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
        }
      } else {
        categoryTree.push(categoryMap[cat.id]);
      }
    });

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

    const db = getDatabase();

    // 如果有父分类，检查父分类是否存在
    if (parent_id) {
      const parent = db.prepare('SELECT * FROM categories WHERE id = ?').get(parent_id);
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

    const result = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name.trim(), parent_id || null);

    await logAction(req.user.id, 'create_category', 'category', result.lastInsertRowid, `创建分类: ${name}`, req.ip);

    res.json({
      success: true,
      message: '分类创建成功',
      data: {
        id: result.lastInsertRowid,
        name: name.trim(),
        parent_id: parent_id || null
      }
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

    const db = getDatabase();
    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id);

    await logAction(req.user.id, 'update_category', 'category', id, `更新分类名称: ${name}`, req.ip);

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
    const db = getDatabase();

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: '分类不存在'
      });
    }

    // 检查是否有子分类
    const children = db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(id);
    if (children.count > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类下有子分类，请先删除子分类'
      });
    }

    // 检查是否有图片使用该分类
    const images = db.prepare('SELECT COUNT(*) as count FROM images WHERE category_id = ?').get(id);
    if (images.count > 0) {
      return res.status(400).json({
        success: false,
        message: '该分类下有图片，请先移动或删除图片'
      });
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    await logAction(req.user.id, 'delete_category', 'category', id, `删除分类: ${category.name}`, req.ip);

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