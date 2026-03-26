/**
 * 数据访问层 - Repository Pattern
 * 封装所有数据库操作，使用 PostgreSQL 和 pgvector
 */

const { getDatabase, getEmbeddingDimension, setEmbeddingDimension, createVectorsTable, getVectorsTableDimension } = require('../models/database-pg');

// ==================== 用户相关操作 ====================

const UserRepository = {
  // 根据ID获取用户
  async findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE id = $1').get(id);
  },

  // 根据用户名获取用户
  async findByUsername(username) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = $1').get(username);
  },

  // 获取所有用户
  async findAll() {
    const db = getDatabase();
    return db.prepare(`
      SELECT id, username, name, description, role, status, quota, valid_from, valid_until, created_at, updated_at
      FROM users ORDER BY id
    `).all();
  },

  // 获取用户的图片数量（不含已删除）
  async getImageCount(userId) {
    const db = getDatabase();
    const result = await db.prepare('SELECT COUNT(*) as count FROM images WHERE uploaded_by = $1 AND is_deleted = 0').get(userId);
    return result?.count || 0;
  },

  // 创建用户
  async create(data) {
    const db = getDatabase();
    const { username, passwordHash, name, description, role, status, quota, validFrom, validUntil } = data;
    const result = await db.prepare(`
      INSERT INTO users (username, password_hash, name, description, role, status, quota, valid_from, valid_until)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `).run(username, passwordHash, name || null, description || null, role || 'user', status !== undefined ? status : 1, quota !== undefined ? quota : 100, validFrom || null, validUntil || null);
    return { id: result.lastInsertRowid, username };
  },

  // 更新用户信息
  async update(id, data) {
    const db = getDatabase();
    const { username, name, description, role, status, quota, validFrom, validUntil } = data;
    await db.prepare(`
      UPDATE users SET username = $1, name = $2, description = $3, role = $4, status = $5, quota = $6, valid_from = $7, valid_until = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
    `).run(username, name || null, description || null, role || 'user', status !== undefined ? status : 1, quota !== undefined ? quota : 100, validFrom || null, validUntil || null, id);
  },

  // 更新用户名
  async updateUsername(id, username) {
    const db = getDatabase();
    await db.prepare('UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2').run(username, id);
  },

  // 更新密码
  async updatePassword(id, passwordHash) {
    const db = getDatabase();
    await db.prepare('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2').run(passwordHash, id);
  },

  // 更新用户名称和说明
  async updateNameAndDescription(id, name, description) {
    const db = getDatabase();
    await db.prepare('UPDATE users SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3').run(name || null, description || null, id);
  },

  // 删除用户
  async delete(id) {
    const db = getDatabase();
    await db.prepare('DELETE FROM users WHERE id = $1').run(id);
  },

  // 检查用户名是否被其他用户占用
  async isUsernameTaken(username, excludeId = null) {
    const db = getDatabase();
    if (excludeId) {
      return db.prepare('SELECT id FROM users WHERE username = $1 AND id != $2').get(username, excludeId);
    }
    return db.prepare('SELECT id FROM users WHERE username = $1').get(username);
  }
};

// ==================== 图片相关操作 ====================

const ImageRepository = {
  // 根据ID获取图片
  async findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images WHERE id = $1').get(id);
  },

  // 根据ID获取图片详情
  async findByIdWithDetails(id) {
    const db = getDatabase();
    return db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id = $1
    `).get(id);
  },

  // 获取图片列表（带筛选和分页）
  async findList(options = {}) {
    const { categoryId, userId, keyword, uploadedBy, isDeleted = 0, page = 1, pageSize = 20, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    const db = getDatabase();

    let sql = `
      SELECT i.*, c.name as category_name, u.username as uploader_name,
             CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      LEFT JOIN favorites f ON i.id = f.image_id AND f.user_id = $1
      WHERE i.is_deleted = $2
    `;
    const params = [userId || 0, isDeleted];
    let paramIndex = 3;

    if (categoryId) {
      sql += ` AND i.category_id = $${paramIndex}`;
      params.push(categoryId);
      paramIndex++;
    }

    if (keyword) {
      sql += ` AND (i.original_name LIKE $${paramIndex} OR i.description LIKE $${paramIndex} OR i.keywords LIKE $${paramIndex})`;
      const likeKeyword = `%${keyword}%`;
      params.push(likeKeyword);
      paramIndex++;
    }

    if (uploadedBy) {
      sql += ` AND i.uploaded_by = $${paramIndex}`;
      params.push(uploadedBy);
      paramIndex++;
    }

    // 计算总数
    const countSql = sql.replace('SELECT i.*, c.name as category_name, u.username as uploader_name,\n             CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as is_favorite', 'SELECT COUNT(*) as total');
    const totalResult = await db.prepare(countSql).get(...params);
    const total = totalResult?.total || 0;

    // 排序和分页
    const validSortFields = ['created_at', 'file_size', 'original_name'];
    const validSortOrders = ['ASC', 'DESC'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const order = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    sql += ` ORDER BY i.${sortField} ${order}`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const images = await db.prepare(sql).all(...params);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = await this.getTags(image.id);
    }

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 创建图片
  async create(data) {
    const db = getDatabase();
    const result = await db.prepare(`
      INSERT INTO images (
        filename, original_name, file_path, thumbnail_path,
        file_size, file_format, width, height,
        description, keywords, category_id, uploaded_by, extracted_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
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
  async update(id, data) {
    const db = getDatabase();
    await db.prepare(`
      UPDATE images SET
        description = COALESCE($1, description),
        category_id = COALESCE($2, category_id),
        keywords = COALESCE($3, keywords),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `).run(data.description, data.categoryId, data.keywords, id);
  },

  // 更新AI识别结果
  async updateAIResult(id, data) {
    const db = getDatabase();
    await db.prepare(`
      UPDATE images SET
        description = $1,
        keywords = $2,
        category_id = $3,
        extracted_text = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `).run(data.description, data.keywords, data.categoryId, data.extractedText || '', id);
  },

  // 删除图片（移入回收站）
  async softDelete(id) {
    const db = getDatabase();
    await db.prepare('UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = $1').run(id);
  },

  // 批量软删除
  async softDeleteBatch(ids) {
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await db.prepare(`UPDATE images SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND is_deleted = 0`).run(...ids);
  },

  // 恢复图片
  async restore(ids) {
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await db.prepare(`UPDATE images SET is_deleted = 0, deleted_at = NULL WHERE id IN (${placeholders}) AND is_deleted = 1`).run(...ids);
  },

  // 彻底删除
  async hardDelete(id) {
    const db = getDatabase();
    await db.prepare('DELETE FROM favorites WHERE image_id = $1').run(id);
    await db.prepare('DELETE FROM image_tags WHERE image_id = $1').run(id);
    await db.prepare('DELETE FROM images WHERE id = $1').run(id);
  },

  // 批量彻底删除
  async hardDeleteBatch(ids) {
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    await db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...ids);
    await db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...ids);
    await db.prepare(`DELETE FROM images WHERE id IN (${placeholders})`).run(...ids);
  },

  // 获取所有已删除图片
  async findDeleted() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM images WHERE is_deleted = 1').all();
  },

  // 清空回收站
  async emptyTrash() {
    const db = getDatabase();
    const deletedImages = await this.findDeleted();
    const imageIds = deletedImages.map(i => i.id);

    if (imageIds.length > 0) {
      const placeholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
      await db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...imageIds);
      await db.prepare(`DELETE FROM image_tags WHERE image_id IN (${placeholders})`).run(...imageIds);
    }
    await db.prepare('DELETE FROM images WHERE is_deleted = 1').run();

    return deletedImages;
  },

  // 更新分类
  async updateCategory(id, categoryId) {
    const db = getDatabase();
    await db.prepare('UPDATE images SET category_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2').run(categoryId, id);
  },

  // 根据ID列表获取图片
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    return db.prepare(`SELECT * FROM images WHERE id IN (${placeholders})`).all(...ids);
  },

  // 根据ID列表获取图片详情
  async findByIdsWithDetails(ids) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    return db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.id IN (${placeholders})
    `).all(...ids);
  },

  // 获取图片的标签
  async getTags(imageId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = $1
    `).all(imageId);
  },

  // 添加标签
  async addTag(imageId, tagId) {
    const db = getDatabase();
    const existing = await db.prepare('SELECT * FROM image_tags WHERE image_id = $1 AND tag_id = $2').get(imageId, tagId);
    if (existing) return false;

    await db.prepare('INSERT INTO image_tags (image_id, tag_id) VALUES ($1, $2)').run(imageId, tagId);
    return true;
  },

  // 移除标签
  async removeTag(imageId, tagId) {
    const db = getDatabase();
    await db.prepare('DELETE FROM image_tags WHERE image_id = $1 AND tag_id = $2').run(imageId, tagId);
  },

  // 移除图片所有标签
  async removeAllTags(imageId) {
    const db = getDatabase();
    await db.prepare('DELETE FROM image_tags WHERE image_id = $1').run(imageId);
  },

  // 统计分类下的图片数量
  async countByCategory(categoryId) {
    const db = getDatabase();
    const result = await db.prepare('SELECT COUNT(*) as count FROM images WHERE category_id = $1').get(categoryId);
    return result?.count || 0;
  },

  // 获取所有图片的描述（用于重建向量索引）
  async findAllDescriptions() {
    const db = getDatabase();
    return db.prepare('SELECT id, description, extracted_text FROM images WHERE is_deleted = 0').all();
  }
};

// ==================== 分类相关操作 ====================

const CategoryRepository = {
  // 获取所有分类
  async findAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories ORDER BY id').all();
  },

  // 根据ID获取分类
  async findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE id = $1').get(id);
  },

  // 根据名称获取分类
  async findByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE name = $1').get(name);
  },

  // 创建分类
  async create(name, parentId = null) {
    const db = getDatabase();
    const result = await db.prepare('INSERT INTO categories (name, parent_id) VALUES ($1, $2) RETURNING id').run(name, parentId);
    return { id: result.lastInsertRowid, name, parent_id: parentId };
  },

  // 更新分类名称
  async update(id, name) {
    const db = getDatabase();
    await db.prepare('UPDATE categories SET name = $1 WHERE id = $2').run(name, id);
  },

  // 删除分类
  async delete(id) {
    const db = getDatabase();
    await db.prepare('DELETE FROM categories WHERE id = $1').run(id);
  },

  // 获取子分类
  async findChildren(parentId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM categories WHERE parent_id = $1').all(parentId);
  },

  // 统计子分类数量
  async countChildren(parentId) {
    const db = getDatabase();
    const result = await db.prepare('SELECT COUNT(*) as count FROM categories WHERE parent_id = $1').get(parentId);
    return result?.count || 0;
  },

  // 获取分类树
  async getTree() {
    const categories = await this.findAll();
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
  async getNameById(id) {
    const db = getDatabase();
    const result = await db.prepare('SELECT name FROM categories WHERE id = $1').get(id);
    return result?.name || null;
  }
};

// ==================== 标签相关操作 ====================

const TagRepository = {
  // 获取所有标签
  async findAll() {
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
  async findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE id = $1').get(id);
  },

  // 根据名称获取标签
  async findByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE name = $1').get(name);
  },

  // 创建标签
  async create(name) {
    const db = getDatabase();
    const result = await db.prepare('INSERT INTO tags (name) VALUES ($1) RETURNING id').run(name);
    return { id: result.lastInsertRowid, name };
  },

  // 更新标签
  async update(id, name) {
    const db = getDatabase();
    await db.prepare('UPDATE tags SET name = $1 WHERE id = $2').run(name, id);
  },

  // 删除标签
  async delete(id) {
    const db = getDatabase();
    await db.prepare('DELETE FROM image_tags WHERE tag_id = $1').run(id);
    await db.prepare('DELETE FROM tags WHERE id = $1').run(id);
  },

  // 检查标签名是否被占用
  async isNameTaken(name, excludeId = null) {
    const db = getDatabase();
    if (excludeId) {
      return db.prepare('SELECT * FROM tags WHERE name = $1 AND id != $2').get(name, excludeId);
    }
    return db.prepare('SELECT * FROM tags WHERE name = $1').get(name);
  },

  // 按标签筛选图片
  async findByTag(tagId, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();

    const totalResult = await db.prepare(`
      SELECT COUNT(*) as total
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      WHERE i.is_deleted = 0 AND it.tag_id = $1
    `).get(tagId);

    const total = totalResult?.total || 0;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = await db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      JOIN image_tags it ON i.id = it.image_id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0 AND it.tag_id = $1
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `).all(tagId, parseInt(pageSize), offset);

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  }
};

// ==================== 日志相关操作 ====================

const LogRepository = {
  // 创建日志
  async create(userId, action, targetType = null, targetId = null, details = null, ipAddress = null) {
    const db = getDatabase();
    await db.prepare(`
      INSERT INTO logs (user_id, action, target_type, target_id, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `).run(userId, action, targetType, targetId, details, ipAddress);
  },

  // 获取日志列表
  async findList(filters = {}) {
    const db = getDatabase();
    let sql = `
      SELECT l.*, u.username
      FROM logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      sql += ` AND l.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      sql += ` AND l.action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.startDate) {
      sql += ` AND l.created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      sql += ` AND l.created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    sql += ' ORDER BY l.created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      sql += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    return db.prepare(sql).all(...params);
  },

  // 获取日志数量
  async count(filters = {}) {
    const db = getDatabase();
    let sql = 'SELECT COUNT(*) as count FROM logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      sql += ` AND user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.action) {
      sql += ` AND action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.startDate) {
      sql += ` AND created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      sql += ` AND created_at <= $${paramIndex}`;
      params.push(filters.endDate);
    }

    const result = await db.prepare(sql).get(...params);
    return result?.count || 0;
  }
};

// ==================== 搜索相关操作 ====================

const SearchRepository = {
  // 关键字搜索
  async searchByKeyword(keyword, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();
    const likeKeyword = `%${keyword}%`;

    const totalResult = await db.prepare(`
      SELECT COUNT(*) as total
      FROM images
      WHERE is_deleted = 0
      AND (original_name LIKE $1 OR description LIKE $1 OR keywords LIKE $1)
    `).get(likeKeyword);

    const total = totalResult?.total || 0;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = await db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name
      FROM images i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE i.is_deleted = 0
      AND (i.original_name LIKE $1 OR i.description LIKE $1 OR i.keywords LIKE $1)
      ORDER BY i.created_at DESC
      LIMIT $2 OFFSET $3
    `).all(likeKeyword, parseInt(pageSize), offset);

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 根据图片ID列表搜索（用于语义搜索）
  async findByIdsSorted(ids, similarityMap) {
    if (!ids || ids.length === 0) return [];
    const db = getDatabase();
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');

    const images = await db.prepare(`
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

// ==================== 向量相关操作 (使用 pgvector) ====================

const VectorRepository = {
  // 添加或更新向量
  async upsert(imageId, embedding, userId = null) {
    const db = getDatabase();
    // 将数组转换为 pgvector 格式字符串
    const embeddingStr = `[${embedding.join(',')}]`;
    await db.prepare(`
      INSERT INTO vectors (image_id, embedding, user_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (image_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        user_id = EXCLUDED.user_id,
        created_at = CURRENT_TIMESTAMP
    `).run(imageId, embeddingStr, userId);
  },

  // 删除向量
  async delete(imageId) {
    const db = getDatabase();
    await db.prepare('DELETE FROM vectors WHERE image_id = $1').run(imageId);
  },

  // 批量删除向量
  async deleteBatch(imageIds) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
    await db.prepare(`DELETE FROM vectors WHERE image_id IN (${placeholders})`).run(...imageIds);
  },

  // 获取单个向量
  async get(imageId) {
    const db = getDatabase();
    const row = await db.prepare('SELECT embedding::text FROM vectors WHERE image_id = $1').get(imageId);
    if (!row) return null;
    try {
      // pgvector 返回的是字符串格式 "[0.1,0.2,...]"
      return JSON.parse(row.embedding);
    } catch {
      return null;
    }
  },

  // 获取所有向量
  async getAll(userId = null) {
    const db = getDatabase();
    let sql = 'SELECT image_id, embedding::text as embedding, user_id FROM vectors';
    const params = [];
    if (userId !== null) {
      sql += ' WHERE user_id = $1';
      params.push(userId);
    }
    const rows = await db.prepare(sql).all(...params);
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

  // 向量相似度搜索 - 使用 pgvector
  async searchSimilar(embedding, k = 10, userId = null) {
    const db = getDatabase();
    const embeddingStr = `[${embedding.join(',')}]`;

    let sql = `
      SELECT image_id, embedding <=> $1 as distance
      FROM vectors
    `;
    const params = [embeddingStr];

    if (userId !== null) {
      sql += ' WHERE user_id = $2';
      params.push(userId);
    }

    sql += ` ORDER BY embedding <=> $1 LIMIT ${k}`;

    const results = await db.prepare(sql).all(...params);

    // 转换为原有格式
    return results.map(r => ({
      imageId: r.image_id,
      distance: r.distance
    }));
  },

  // 批量更新向量的用户ID
  async updateUserId(imageIds, userId) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map((_, i) => `$${i + 2}`).join(',');
    await db.prepare(`UPDATE vectors SET user_id = $1 WHERE image_id IN (${placeholders})`).run(userId, ...imageIds);
  },

  // 清空所有向量
  async clear() {
    const db = getDatabase();
    await db.prepare('DELETE FROM vectors').run();
  },

  // 获取向量数量
  async count() {
    const db = getDatabase();
    const result = await db.prepare('SELECT COUNT(*) as count FROM vectors').get();
    return result?.count || 0;
  }
};

// ==================== 统计相关操作 ====================

const StatsRepository = {
  // 获取系统总统计
  async getSystemStats() {
    const db = getDatabase();

    const imageCountResult = await db.prepare('SELECT COUNT(*) as count FROM images WHERE is_deleted = 0').get();
    const imageCount = imageCountResult?.count || 0;

    const totalBytesResult = await db.prepare('SELECT COALESCE(SUM(file_size), 0) as total FROM images WHERE is_deleted = 0').get();
    const totalBytes = totalBytesResult?.total || 0;

    const vectorCountResult = await db.prepare('SELECT COUNT(*) as count FROM vectors').get();
    const vectorCount = vectorCountResult?.count || 0;

    const userCountResult = await db.prepare('SELECT COUNT(*) as count FROM users').get();
    const userCount = userCountResult?.count || 0;

    const categoryCountResult = await db.prepare('SELECT COUNT(*) as count FROM categories').get();
    const categoryCount = categoryCountResult?.count || 0;

    const tagCountResult = await db.prepare('SELECT COUNT(*) as count FROM tags').get();
    const tagCount = tagCountResult?.count || 0;

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
  async getUserRanking(limit = 10) {
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
      LIMIT $1
    `).all(limit);
  }
};

// ==================== 收藏相关操作 ====================

const FavoriteRepository = {
  // 检查是否已收藏
  async isFavorited(userId, imageId) {
    const db = getDatabase();
    return db.prepare('SELECT id FROM favorites WHERE user_id = $1 AND image_id = $2').get(userId, imageId);
  },

  // 添加收藏
  async add(userId, imageId) {
    const db = getDatabase();
    try {
      await db.prepare('INSERT INTO favorites (user_id, image_id) VALUES ($1, $2)').run(userId, imageId);
      return true;
    } catch (e) {
      return false;
    }
  },

  // 取消收藏
  async remove(userId, imageId) {
    const db = getDatabase();
    await db.prepare('DELETE FROM favorites WHERE user_id = $1 AND image_id = $2').run(userId, imageId);
  },

  // 切换收藏状态
  async toggle(userId, imageId) {
    const existing = await this.isFavorited(userId, imageId);
    if (existing) {
      await this.remove(userId, imageId);
      return false;
    } else {
      await this.add(userId, imageId);
      return true;
    }
  },

  // 获取用户收藏列表
  async findByUser(userId, options = {}) {
    const { page = 1, pageSize = 20 } = options;
    const db = getDatabase();

    const totalResult = await db.prepare(`
      SELECT COUNT(*) as total
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      WHERE f.user_id = $1 AND i.is_deleted = 0
    `).get(userId);

    const total = totalResult?.total || 0;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const images = await db.prepare(`
      SELECT i.*, c.name as category_name, u.username as uploader_name, 1 as is_favorite
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN users u ON i.uploaded_by = u.id
      WHERE f.user_id = $1 AND i.is_deleted = 0
      ORDER BY f.created_at DESC
      LIMIT $2 OFFSET $3
    `).all(userId, parseInt(pageSize), offset);

    // 获取每张图片的标签
    for (const image of images) {
      image.tags = await db.prepare(`
        SELECT t.* FROM tags t
        JOIN image_tags it ON t.id = it.tag_id
        WHERE it.image_id = $1
      `).all(image.id);
    }

    return { list: images, total, page: parseInt(page), pageSize: parseInt(pageSize) };
  },

  // 获取用户收藏数量
  async countByUser(userId) {
    const db = getDatabase();
    const result = await db.prepare(`
      SELECT COUNT(*) as count
      FROM favorites f
      JOIN images i ON f.image_id = i.id
      WHERE f.user_id = $1 AND i.is_deleted = 0
    `).get(userId);
    return result?.count || 0;
  },

  // 删除图片的所有收藏记录
  async deleteByImage(imageId) {
    const db = getDatabase();
    await db.prepare('DELETE FROM favorites WHERE image_id = $1').run(imageId);
  },

  // 批量删除图片的收藏记录
  async deleteByImages(imageIds) {
    if (!imageIds || imageIds.length === 0) return;
    const db = getDatabase();
    const placeholders = imageIds.map((_, i) => `$${i + 1}`).join(',');
    await db.prepare(`DELETE FROM favorites WHERE image_id IN (${placeholders})`).run(...imageIds);
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
  FavoriteRepository,
  getEmbeddingDimension,
  setEmbeddingDimension,
  createVectorsTable,
  getVectorsTableDimension
};