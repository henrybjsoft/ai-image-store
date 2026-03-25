/**
 * 数据访问层 - Repository Pattern
 * 封装所有数据库操作，便于后期切换数据库
 */

const { getDatabase } = require('../models/database');

// ==================== 用户相关操作 ====================

const UserRepository = {
  // 根据ID获取用户
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },

  // 根据用户名获取用户
  findByUsername(username) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  // 获取所有用户（含新字段）
  findAll() {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, username, name, description, role, status, quota, valid_from, valid_until, created_at, updated_at
      FROM users ORDER BY id
    `).all();
  },

  // 获取用户的图片数量（不含已删除）
  getImageCount(userId) {
    const db = getDatabase();
    const result = db.prepare('SELECT COUNT(*) as count FROM images WHERE uploaded_by = ? AND is_deleted = 0').get(userId);
    return result?.count || 0;
  },

  // 创建用户（支持新字段）
  create(data) {
    const db = getDatabase();
    const { username, passwordHash, name, description, role, status, quota, validFrom, validUntil } = data;
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, name, description, role, status, quota, valid_from, valid_until)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, passwordHash, name || null, description || null, role || 'user', status !== undefined ? status : 1, quota !== undefined ? quota : 100, validFrom || null, validUntil || null);
    return { id: result.lastInsertRowid, username };
  },

  // 更新用户信息（支持新字段）
  update(id, data) {
    const db = getDatabase();
    const { username, name, description, role, status, quota, validFrom, validUntil } = data;
    db.prepare(`
      UPDATE users SET username = ?, name = ?, description = ?, role = ?, status = ?, quota = ?, valid_from = ?, valid_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(username, name || null, description || null, role || 'user', status !== undefined ? status : 1, quota !== undefined ? quota : 100, validFrom || null, validUntil || null, id);
  },

  // 更新用户名
  updateUsername(id, username) {
    const db = getDatabase();
    db.prepare('UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(username, id);
  },

  // 更新密码
  updatePassword(id, passwordHash) {
    const db = getDatabase();
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(passwordHash, id);
  },

  // 更新用户名称和说明（用于admin用户的受限更新）
  updateNameAndDescription(id, name, description) {
    const db = getDatabase();
    db.prepare('UPDATE users SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name || null, description || null, id);
  },

  // 删除用户
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  },

  // 检查用户名是否被其他用户占用
  isUsernameTaken(username, excludeId = null) {
    const db = getDatabase();
    if (excludeId) {
      return db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, excludeId);
    }
    return db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  }
};

// ==================== 图片相关操作 ====================

const ImageRepository = {
  // 根据ID获取图片
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  },

  // 根据ID获取图片详情（含分类名和上传者名）
  findByIdWithDetails(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id = ?
    `).get(id);
  },

  // 获取图片列表（带筛选和分页）
  findList(options = {}) {
    const { categoryId, userId, keyword, uploadedBy, isDeleted = 0, page = 1, pageSize = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    const db = getDatabase();

    let sql = `
      SELECT i.*, c.name as category_name, u.username as uploader_name,
             CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = ?
      WHERE i.is_deleted = ?
    `;
    const params = [userId || 0, isDeleted];

    if (categoryId) {
      sql += ' AND i.category_id = ?';
      params.push(categoryId);
    }

    if (keyword) {
      sql += ' AND (i.original_name LIKE ? OR i.description LIKE ? OR i.keywords LIKE ?)';
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword, likeKeyword, likeKeyword);
    }

    if (uploadedBy) {
      sql += ' AND i.uploaded_by = ?';
      params.push(uploadedBy);
    }

    // 计算总数
    const countSql = sql.replace('SELECT i.*, c.name as category_name, u.username as uploader_name,\n             CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite', 'SELECT COUNT(*) as total');
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
      image.tags = this.getTags(image.id);
    }

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 创建图片
  create(data) {
    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO images (
        filename, original_name, file_path, thumbnail_path,
        file_size, file_format, width, height,
        description, keywords, category_id, uploaded_by, extracted_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.filename,
      data.originalName,
      data.filePath,
      data.thumbnailPath,
      data.fileSize,
      data.fileFormat,
      data.width,
      data.height,
      data.description,
      data.keywords,
      data.categoryId,
      data.uploadedBy,
      data.extractedText || ''
    );
    return result.lastInsertRowid;
  },

  // 更新图片信息
  update(id, data) {
    const db = getDatabase();
    db.prepare(`
      UPDATE images SET
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        keywords = COALESCE(?, keywords),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.description, data.categoryId, data.keywords, id);
  },

  // 更新AI识别结果
  updateAIResult(id, data) {
    const db = getDatabase();
    db.prepare(`
      UPDATE images SET
        description = ?,
        keywords = ?,
        category_id = ?,
        extracted_text = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.description, data.keywords, data.categoryId, data.extractedText || '', id);
  },

  // 删除图片（移入回收站）
  softDelete(id) {
    const db = getDatabase();
    db.prepare('UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  },

  // 批量软删除
  softDeleteBatch(ids) {
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND is_deleted = 0`).run(...ids);
  },

  // 恢复图片
  restore(ids) {
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE images SET is_deleted = 0, deleted_at = NULL WHERE id IN (${placeholders}) AND is_deleted = 1`).run(...ids);
  },

  // 彻底删除
  hardDelete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM favorites WHERE image_id = ?').run(id);
    db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(id);
    db.prepare('DELETE FROM images WHERE id = ?').run(id);
  },

  // 批量彻底删除
  hardDeleteBatch(ids) {
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...ids);
  },

  // 获取所有已删除图片
  findDeleted() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images WHERE is_deleted = 1').all();
  },

  // 清空回收站
  emptyTrash() {
    const db = getDatabase();
    const deletedImages = this.findDeleted();
    const imageIds = deletedImages.map(i => i.id);

    if (imageIds.length > 0) {
      const placeholders = imageIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...imageIds);
      db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...imageIds);
    }
    db.prepare('DELETE FROM images WHERE is_deleted = 1').run();

    return deletedImages;
  },

  // 更新分类
  updateCategory(id, categoryId) {
    const db = getDatabase();
    db.prepare('UPDATE images SET category_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(categoryId, id);
  },

  // 根据ID列表获取图片
  findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`).all(...ids);
  },

  // 根据ID列表获取图片详情
  findByIdsWithDetails(ids) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id IN (${placeholders})
    `).all(...ids);
  },

  // 获取图片的标签
  getTags(imageId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
    `).all(imageId);
  },

  // 添加标签
  addTag(imageId, tagId) {
    const db = getDatabase();
    // 检查是否已有该标签
    const existing = db.prepare('SELECT * FROM image_tags WHERE image_id = ? AND tag_id = ?').get(imageId, tagId);
    if (existing) return false;

    db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES (?, ?)').run(imageId, tagId);
    return true;
  },

  // 移除标签
  removeTag(imageId, tagId) {
    const db = getDatabase();
    db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?').run(imageId, tagId);
  },

  // 移除图片所有标签
  removeAllTags(imageId) {
    const db = getDatabase();
    db.prepare('DELETE FROM image_tags WHERE image_id = ?').run(imageId);
  },

  // 统计分类下的图片数量
  countByCategory(categoryId) {
    const db = getDatabase();
    return db.prepare('SELECT COUNT(*) as count FROM images WHERE category_id = ?').get(categoryId).count;
  },

  // 获取所有图片的描述（用于重建向量索引）
  findAllDescriptions() {
    const db = getDatabase();
    return db.prepare('SELECT id, description, extracted_text FROM images WHERE is_deleted = 0').all();
  }
};

// ==================== 分类相关操作 ====================

const CategoryRepository = {
  // 获取所有分类
  findAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories ORDER BY id').all();
  },

  // 根据ID获取分类
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  // 根据名称获取分类
  findByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
  },

  // 创建分类
  create(name, parentId = null) {
    const db = getDatabase();
    const result = db.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(name, parentId);
    return { id: result.lastInsertRowid, name, parent_id: parentId };
  },

  // 更新分类名称
  update(id, name) {
    const db = getDatabase();
    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
  },

  // 删除分类
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  },

  // 获取子分类
  findChildren(parentId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE parent_id = ?').all(parentId);
  },

  // 统计子分类数量
  countChildren(parentId) {
    const db = getDatabase();
    return db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = ?').get(parentId).count;
  },

  // 获取分类树
  getTree() {
    const categories = this.findAll();
    const categoryTree = [];
    const categoryMap = {};

    categories.forEach(cat => {
      categoryMap[cat.id] = { ...cat, children: [] };
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

    return categoryTree;
  },

  // 获取分类名称
  getNameById(id) {
    const db = getDatabase();
    const result = db.prepare('SELECT name FROM categories WHERE id = ?').get(id);
    return result?.name || null;
  }
};

// ==================== 标签相关操作 ====================

const TagRepository = {
  // 获取所有标签
  findAll() {
    const db = getDatabase();
    return db.prepare(`
      SELECT t.*, COUNT(it.image_id) as image_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      LEFT JOIN images i ON it.image_id = i.id AND i.is_deleted = 0
      GROUP BY t.id
      ORDER BY t.name
    `).all();
  },

  // 根据ID获取标签
  findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
  },

  // 根据名称获取标签
  findByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
  },

  // 创建标签
  create(name) {
    const db = getDatabase();
    const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    return { id: result.lastInsertRowid, name };
  },

  // 更新标签
  update(id, name) {
    const db = getDatabase();
    db.prepare('UPDATE tags SET name = ? WHERE id = ?').run(name, id);
  },

  // 删除标签
  delete(id) {
    const db = getDatabase();
    db.prepare('DELETE FROM image_tags WHERE tag_id = ?').run(id);
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
  },

  // 检查标签名是否被占用
  isNameTaken(name, excludeId = null) {
    const db = getDatabase();
    if (excludeId) {
      return db.prepare('SELECT * FROM tags WHERE name = ? AND id != ?').get(name, excludeId);
    }
    return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
  },

  // 按标签筛选图片
  findByTag(tagId, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      WHERE i.is_deleted = 0 AND it.tag_id = ?
    `).get(tagId);

    const total = totalResult.total;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0 AND it.tag_id = ?
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(tagId, parseInt(pageSize), offset);

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  }
};

// ==================== 日志相关操作 ====================

const LogRepository = {
  // 创建日志
  create(userId, action, targetType = null, targetId = null, details = null, ipAddress = null) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO logs (user_id, action, target_type, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, targetType, targetId, details, ipAddress);
  },

  // 获取日志列表
  findList(filters = {}) {
    const db = getDatabase();
    let sql = `
      SELECT l.*, u.username
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.userId) {
      sql += ' AND l.user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      sql += ' AND l.action = ?';
      params.push(filters.action);
    }

    if (filters.startDate) {
      sql += ' AND l.created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND l.created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY l.created_at DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return db.prepare(sql).all(...params);
  },

  // 获取日志数量
  count(filters = {}) {
    const db = getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    return db.prepare(sql).get(...params).count;
  }
};

// ==================== 搜索相关操作 ====================

const SearchRepository = {
  // 关键字搜索
  searchByKeyword(keyword, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();
    const likeKeyword = `%${keyword}%`;

    const totalResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM images
      WHERE is_deleted = 0
      AND (original_name LIKE ? OR description LIKE ? OR keywords LIKE ?)
    `).get(likeKeyword, likeKeyword, likeKeyword);

    const total = totalResult.total;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0
      AND (i.original_name LIKE ? OR i.description LIKE ? OR i.keywords LIKE ?)
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(likeKeyword, likeKeyword, likeKeyword, parseInt(pageSize), offset);

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 根据图片ID列表搜索（用于语义搜索）
  findByIdsSorted(ids, similarityMap) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map(() => '?').join(',');

    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id IN (${placeholders}) AND i.is_deleted = 0
    `).all(...ids);

    // 按相似度排序
    images.sort((a, b) => {
      return (similarityMap.get(a.id) || Infinity) - (similarityMap.get(b.id) || Infinity);
    });

    return images;
  }
};

// ==================== 向量相关操作 ====================

const VectorRepository = {
  // 添加或更新向量
  upsert(imageId, embedding, userId = null) {
    const db = getDatabase();
    const embeddingJson = JSON.stringify(embedding);
    db.prepare(`
      INSERT INTO vectors (image_id, embedding, user_id) VALUES (?, ?, ?)
      ON CONFLICT(image_id) DO UPDATE SET embedding = excluded.embedding, user_id = excluded.user_id, created_at = CURRENT_TIMESTAMP
    `).run(imageId, embeddingJson, userId);
  },

  // 删除向量
  delete(imageId) {
    const db = getDatabase();
    db.prepare('DELETE FROM vectors WHERE image_id = ?').run(imageId);
  },

  // 批量删除向量
  deleteBatch(imageIds) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM vectors WHERE image_id IN (${placeholders})`).run(...imageIds);
  },

  // 获取单个向量
  get(imageId) {
    const db = getDatabase();
    const row = db.prepare('SELECT embedding FROM vectors WHERE image_id = ?').get(imageId);
    if (!row) return null;
    try {
      return JSON.parse(row.embedding);
    } catch {
      return null;
    }
  },

  // 获取所有向量
  getAll(userId = null) {
    const db = getDatabase();
    let sql = 'SELECT image_id, embedding, user_id FROM vectors';
    const params = [];
    if (userId !== null) {
      sql += ' WHERE user_id = ?';
      params.push(userId);
    }
    const rows = db.prepare(sql).all(...params);
    const vectors = {};
    for (const row of rows) {
      try {
        vectors[row.image_id] = {
          embedding: JSON.parse(row.embedding),
          userId: row.user_id,
          createdAt: row.created_at
        };
      } catch {}
    }
    return vectors;
  },

  // 批量更新向量的用户ID
  updateUserId(imageIds, userId) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map(() => '?').join(',');
    db.prepare(`UPDATE vectors SET user_id = ? WHERE image_id IN (${placeholders})`).run(userId, ...imageIds);
  },

  // 清空所有向量
  clear() {
    const db = getDatabase();
    db.prepare('DELETE FROM vectors').run();
  },

  // 获取向量数量
  count() {
    const db = getDatabase();
    return db.prepare('SELECT COUNT(*) as count FROM vectors').get().count;
  }
};

// ==================== 统计相关操作 ====================

const StatsRepository = {
  // 获取系统总统计
  getSystemStats() {
    const db = getDatabase();

    // 图片总数（不含回收站）
    const imageCount = db.prepare('SELECT COUNT(*) as count FROM images WHERE is_deleted = 0').get().count;

    // 总字节数
    const totalBytes = db.prepare('SELECT COALESCE(SUM(file_size), 0) as total FROM images WHERE is_deleted = 0').get().total;

    // 向量数量
    const vectorCount = db.prepare('SELECT COUNT(*) as count FROM vectors').get().count;

    // 用户数量
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    // 分类数量
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;

    // 标签数量
    const tagCount = db.prepare('SELECT COUNT(*) as count FROM tags').get().count;

    return {
      imageCount,
      totalBytes,
      vectorCount,
      userCount,
      categoryCount,
      tagCount
    };
  },

  // 获取用户图片数量排名
  getUserRanking(limit = 10) {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.role,
        COUNT(i.id) as image_count,
        COALESCE(SUM(i.file_size), 0) as total_bytes
      FROM users u
      LEFT JOIN images i ON u.id = i.uploaded_by AND i.is_deleted = 0
      GROUP BY u.id
      ORDER BY image_count DESC
      LIMIT ?
    `).all(limit);
  }
};

// ==================== 收藏相关操作 ====================

const FavoriteRepository = {
  // 检查是否已收藏
  isFavorited(userId, imageId) {
    const db = getDatabase();
    return db.prepare('SELECT id FROM favorites WHERE user_id = ? AND image_id = ?').get(userId, imageId);
  },

  // 添加收藏
  add(userId, imageId) {
    const db = getDatabase();
    try {
      db.prepare('INSERT INTO favorites (user_id, image_id) VALUES (?, ?)').run(userId, imageId);
      return true;
    } catch (e) {
      // 已存在则忽略
      return false;
    }
  },

  // 取消收藏
  remove(userId, imageId) {
    const db = getDatabase();
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND image_id = ?').run(userId, imageId);
  },

  // 切换收藏状态
  toggle(userId, imageId) {
    const existing = this.isFavorited(userId, imageId);
    if (existing) {
      this.remove(userId, imageId);
      return false;
    } else {
      this.add(userId, imageId);
      return true;
    }
  },

  // 获取用户收藏列表
  findByUser(userId, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      WHERE f.user_id = ? AND i.is_deleted = 0
    `).get(userId);

    const total = totalResult.total;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name, 1 as is_favorite
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE f.user_id = ? AND i.is_deleted = 0
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, parseInt(pageSize), offset);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = ?
      `).all(image.id);
    }

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 获取用户收藏数量
  countByUser(userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      WHERE f.user_id = ? AND i.is_deleted = 0
    `).get(userId).count;
  },

  // 删除图片的所有收藏记录
  deleteByImage(imageId) {
    const db = getDatabase();
    db.prepare('DELETE FROM favorites WHERE image_id = ?').run(imageId);
  },

  // 批量删除图片的收藏记录
  deleteByImages(imageIds) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map(() => '?').join(',');
    db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...imageIds);
  }
};

module.exports = {
  UserRepository,
  ImageRepository,
  CategoryRepository,
  TagRepository,
  LogRepository,
  SearchRepository,
  VectorRepository,
  StatsRepository,
  FavoriteRepository
};