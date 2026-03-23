const express = require('express');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middlewares/auth');
const { logAction } = require('../services/logService');

const router = express.Router();

// 获取所有标签（公开）
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const tags = db.prepare(`
      SELECT t.*, COUNT(it.image_id) as image_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      LEFT JOIN images i ON it.image_id = i.id AND i.is_deleted = 0
      GROUP BY t.id
      ORDER BY t.name
    `).all();

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

    const db = getDatabase();

    // 检查标签是否已存在
    const existingTag = db.prepare('SELECT * FROM tags WHERE name = ?').get(name.trim());
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: '标签已存在'
      });
    }

    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name.trim());

    await logAction(req.user.id, 'create_tag', 'tag', result.lastInsertRowid, `创建标签: ${name}`, req.ip);

    res.json({
      success: true,
      message: '标签创建成功',
      data: {
        id: result.lastInsertRowid,
        name: name.trim()
      }
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

    const db = getDatabase();
    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    // 检查标签名是否被占用
    const existingTag = db.prepare('SELECT * FROM tags WHERE name = ? AND id != ?').get(name.trim(), id);
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: '标签名已被使用'
      });
    }

    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), id);

    await logAction(req.user.id, 'update_tag', 'tag', id, `更新标签: ${tag.name} -> ${name}`, req.ip);

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
    const db = getDatabase();

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    // 删除图片标签关联
    db.prepare('DELETE FROM image_tags WHERE tag_id = ?').run(id);
    // 删除标签
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);

    await logAction(req.user.id, 'delete_tag', 'tag', id, `删除标签: ${tag.name}`, req.ip);

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