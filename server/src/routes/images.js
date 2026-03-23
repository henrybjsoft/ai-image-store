const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const archiver = require('archiver');
const { getDatabase } = require('../models/database');
const { authenticateToken } = require('../middlewares/auth');
const { logAction } = require('../services/logService');
const { processImageWithAI, getEmbedding } = require('../services/aiService');
const { addImageVector, removeImageVector } = require('../services/vectorService');

const router = express.Router();

// 配置文件上传
const UPLOAD_DIR = path.join(__dirname, '../../uploads');
const THUMBNAIL_DIR = path.join(UPLOAD_DIR, 'thumbnails');

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const dir = path.join(UPLOAD_DIR, yearMonth);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
const MAX_FILES = parseInt(process.env.MAX_FILES) || 20;

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  if (ALLOWED_FORMATS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件格式: ${ext}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES
  }
});

// 创建缩略图
async function createThumbnail(filePath, filename) {
  try {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.svg') {
      return null; // SVG 不生成缩略图
    }

    const thumbnailFilename = `thumb_${path.basename(filename, ext)}.jpg`;
    const thumbnailPath = path.join(THUMBNAIL_DIR, thumbnailFilename);

    await sharp(filePath)
      .resize(300, 300, { fit: 'inside' })
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return thumbnailPath;
  } catch (error) {
    console.error('创建缩略图失败:', error);
    return null;
  }
}

// 获取图片尺寸
async function getImageDimensions(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.svg') {
      return { width: null, height: null };
    }

    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    return { width: null, height: null };
  }
}

// 批量上传图片
router.post('/upload', authenticateToken, upload.array('images', MAX_FILES), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    const results = [];
    const db = getDatabase();

    for (const file of req.files) {
      try {
        // 获取图片尺寸
        const dimensions = await getImageDimensions(file.path);

        // 创建缩略图
        const thumbnailPath = await createThumbnail(file.path, file.filename);

        // 调用 AI 识别图片
        const aiResult = await processImageWithAI(file.path);

        // 保存图片信息到数据库
        const result = db.prepare(`
          INSERT INTO images (
            filename, original_name, file_path, thumbnail_path,
            file_size, file_format, width, height,
            description, keywords, category_id, uploaded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          file.filename,
          file.originalname,
          file.path,
          thumbnailPath,
          file.size,
          path.extname(file.originalname).toLowerCase().slice(1),
          dimensions.width,
          dimensions.height,
          aiResult.description,
          JSON.stringify(aiResult.keywords),
          aiResult.categoryId,
          req.user.id
        );

        const imageId = result.lastInsertRowid;

        // 获取描述的向量并存储
        const embedding = await getEmbedding(aiResult.description);
        await addImageVector(imageId, embedding);

        results.push({
          id: imageId,
          filename: file.filename,
          original_name: file.originalname,
          success: true
        });

        await logAction(req.user.id, 'upload_image', 'image', imageId, `上传图片: ${file.originalname}`, req.ip);
      } catch (error) {
        console.error('处理图片失败:', error);
        results.push({
          filename: file.filename,
          original_name: file.originalname,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `成功上传 ${results.filter(r => r.success).length}/${req.files.length} 张图片`,
      data: results
    });
  } catch (error) {
    console.error('上传图片错误:', error);
    res.status(500).json({
      success: false,
      message: error.message || '上传图片失败'
    });
  }
});

// 获取图片列表
router.get('/', authenticateToken, (req, res) => {
  try {
    const {
      categoryId,
      isFavorite,
      keyword,
      page = 1,
      pageSize = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const db = getDatabase();
    let sql = `
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0
    `;
    const params = [];

    if (categoryId) {
      sql += ' AND i.category_id = ?';
      params.push(categoryId);
    }

    if (isFavorite === 'true') {
      sql += ' AND i.is_favorite = 1';
    }

    if (keyword) {
      sql += ' AND (i.original_name LIKE ? OR i.description LIKE ? OR i.keywords LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    // 计算总数
    const countSql = sql.replace('SELECT i.*, c.name as category_name, u.username as uploader_name', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;

    // 排序和分页
    const validSortFields = ['created_at', 'file_size', 'original_name'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    sql += ` ORDER BY i.${sortField} ${order}`;
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const images = db.prepare(sql).all(...params);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
      `).all(image.id);

      if (image.keywords) {
        try {
          image.keywords = JSON.parse(image.keywords);
        } catch (e) {
          image.keywords = [];
        }
      }
    }

    res.json({
      success: true,
      data: {
        list: images,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    console.error('获取图片列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片列表失败'
    });
  }
});

// 获取图片详情
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const image = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id = ? AND i.is_deleted = 0
    `).get(id);

    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    // 获取标签
    image.tags = db.prepare(`
      SELECT t.* FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
    `).all(id);

    if (image.keywords) {
      try {
        image.keywords = JSON.parse(image.keywords);
      } catch (e) {
        image.keywords = [];
      }
    }

    res.json({
      success: true,
      data: image
    });
  } catch (error) {
    console.error('获取图片详情错误:', error);
    res.status(500).json({
      success: false,
      message: '获取图片详情失败'
    });
  }
});

// 更新图片信息
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, categoryId, keywords } = req.body;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 0').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    db.prepare(`
      UPDATE images SET
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        keywords = COALESCE(?, keywords),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      description,
      categoryId,
      keywords ? JSON.stringify(keywords) : null,
      id
    );

    await logAction(req.user.id, 'update_image', 'image', id, `更新图片信息`, req.ip);

    res.json({
      success: true,
      message: '图片信息更新成功'
    });
  } catch (error) {
    console.error('更新图片错误:', error);
    res.status(500).json({
      success: false,
      message: '更新图片失败'
    });
  }
});

// 删除图片（移入回收站）
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    db.prepare('UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);

    await logAction(req.user.id, 'delete_image', 'image', id, `删除图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '图片已移入回收站'
    });
  } catch (error) {
    console.error('删除图片错误:', error);
    res.status(500).json({
      success: false,
      message: '删除图片失败'
    });
  }
});

// 批量删除
router.post('/batch-delete', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要删除的图片'
      });
    }

    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');

    db.prepare(`
      UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders}) AND is_deleted = 0
    `).run(...ids);

    await logAction(req.user.id, 'batch_delete_images', 'image', null, `批量删除 ${ids.length} 张图片`, req.ip);

    res.json({
      success: true,
      message: `已删除 ${ids.length} 张图片`
    });
  } catch (error) {
    console.error('批量删除错误:', error);
    res.status(500).json({
      success: false,
      message: '批量删除失败'
    });
  }
});

// 下载单张图片
router.get('/download/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 0').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    res.download(image.file_path, image.original_name);
  } catch (error) {
    console.error('下载图片错误:', error);
    res.status(500).json({
      success: false,
      message: '下载图片失败'
    });
  }
});

// 批量下载
router.post('/batch-download', authenticateToken, (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请选择要下载的图片'
      });
    }

    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    const images = db.prepare(`
      SELECT * FROM images WHERE id IN (${placeholders}) AND is_deleted = 0
    `).all(...ids);

    if (images.length === 0) {
      return res.status(404).json({
        success: false,
        message: '没有可下载的图片'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=images_${Date.now()}.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const image of images) {
      if (fs.existsSync(image.file_path)) {
        archive.file(image.file_path, { name: image.original_name });
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('批量下载错误:', error);
    res.status(500).json({
      success: false,
      message: '批量下载失败'
    });
  }
});

// 收藏/取消收藏
router.put('/:id/favorite', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 0').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const newStatus = image.is_favorite ? 0 : 1;
    db.prepare('UPDATE images SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

    await logAction(req.user.id, newStatus ? 'favorite_image' : 'unfavorite_image', 'image', id,
      `${newStatus ? '收藏' : '取消收藏'}图片: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: newStatus ? '已收藏' : '已取消收藏',
      data: { is_favorite: newStatus }
    });
  } catch (error) {
    console.error('收藏操作错误:', error);
    res.status(500).json({
      success: false,
      message: '收藏操作失败'
    });
  }
});

// 调整分类
router.put('/:id/category', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { categoryId } = req.body;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 0').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    db.prepare('UPDATE images SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(categoryId, id);

    await logAction(req.user.id, 'change_category', 'image', id, `调整图片分类: ${image.original_name}`, req.ip);

    res.json({
      success: true,
      message: '分类调整成功'
    });
  } catch (error) {
    console.error('调整分类错误:', error);
    res.status(500).json({
      success: false,
      message: '调整分类失败'
    });
  }
});

// 为图片添加标签
router.post('/:id/tags', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tagId } = req.body;
    const db = getDatabase();

    const image = db.prepare('SELECT * FROM images WHERE id = ? AND is_deleted = 0').get(id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }

    const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      });
    }

    // 检查是否已有该标签
    const existingTag = db.prepare('SELECT * FROM image_tags WHERE image_id = ? AND tag_id = ?').get(id, tagId);
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: '图片已有该标签'
      });
    }

    db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)').run(id, tagId);

    await logAction(req.user.id, 'add_tag', 'image', id, `为图片添加标签: ${tag.name}`, req.ip);

    res.json({
      success: true,
      message: '标签添加成功'
    });
  } catch (error) {
    console.error('添加标签错误:', error);
    res.status(500).json({
      success: false,
      message: '添加标签失败'
    });
  }
});

// 移除图片标签
router.delete('/:id/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { id, tagId } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?').run(id, tagId);

    await logAction(req.user.id, 'remove_tag', 'image', id, `移除图片标签`, req.ip);

    res.json({
      success: true,
      message: '标签移除成功'
    });
  } catch (error) {
    console.error('移除标签错误:', error);
    res.status(500).json({
      success: false,
      message: '移除标签失败'
    });
  }
});

module.exports = router;