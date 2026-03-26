/**
 * PostgreSQL 数据库连接模块
 * 使用 pg 库连接 PostgreSQL，支持 pgvector 扩展
 *
 * 时间处理规则：
 * 1. 数据库存储本地时间，不做 UTC 转换
 * 2. 连接时设置时区（通过环境变量 TZ 配置，默认 Asia/Shanghai），CURRENT_TIMESTAMP 返回本地时间
 * 3. pg 驱动返回字符串而不是 Date 对象，避免 JSON 序列化时自动转 UTC
 */
const { Pool, types } = require('pg');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// 配置 pg 驱动返回字符串而不是 Date 对象
// OID 1114 = timestamp, 1184 = timestamptz
types.setTypeParser(1114, (val) => val);
types.setTypeParser(1184, (val) => val);

// 时区配置，可通过环境变量 TZ 设置，默认东8区
const timezone = process.env.TZ || 'Asia/Shanghai';

// 连接池配置
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT) || 5432,
  database: process.env.PG_DATABASE || 'image_asset',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres'
});

// 设置时区，让 CURRENT_TIMESTAMP 返回本地时间
pool.on('connect', async (client) => {
  await client.query(`SET TIME ZONE '${timezone}'`);
});

// 向量维度（默认 1024，可通过环境变量或 AI Provider 配置）
let embeddingDimension = parseInt(process.env.EMBEDDING_DIMENSION) || 1024;

// 获取当前向量维度
function getEmbeddingDimension() {
  return embeddingDimension;
}

// 设置向量维度
function setEmbeddingDimension(dim) {
  embeddingDimension = dim;
}

// 获取数据库实例（兼容原有 API）
function getDatabase() {
  return {
    prepare: (sql) => {
      return {
        run: async (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            // 转换 SQL 中的 ? 占位符为 $1, $2, ... 格式
            const pgSql = convertPlaceholders(sql);
            const result = await pool.query(pgSql, paramList);

            // 获取最后插入的 ID
            const lastInsertRowid = result.rows[0]?.id || result.rows[0]?.lastInsertRowid || 0;
            return { lastInsertRowid, changes: result.rowCount || 0 };
          } catch (e) {
            console.error('SQL run error:', e, sql, paramList);
            throw e;
          }
        },
        get: async (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            const pgSql = convertPlaceholders(sql);
            const result = await pool.query(pgSql, paramList);
            return result.rows[0] || undefined;
          } catch (e) {
            console.error('SQL get error:', e, sql, paramList);
            throw e;
          }
        },
        all: async (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            const pgSql = convertPlaceholders(sql);
            const result = await pool.query(pgSql, paramList);
            return result.rows;
          } catch (e) {
            console.error('SQL all error:', e, sql, paramList);
            throw e;
          }
        }
      };
    },
    exec: async (sql) => {
      try {
        const pgSql = convertPlaceholders(sql);
        await pool.query(pgSql);
      } catch (e) {
        console.error('SQL exec error:', e, sql);
        throw e;
      }
    }
  };
}

/**
 * 将 SQLite 的 ? 占位符转换为 PostgreSQL 的 $1, $2, ... 格式
 */
function convertPlaceholders(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * 初始化 pgvector 扩展
 */
async function initVectorExtension() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector 扩展已启用');
  } catch (e) {
    console.error('启用 pgvector 扩展失败:', e.message);
    throw e;
  }
}

/**
 * 创建向量表
 */
async function createVectorsTable(dimension) {
  const dim = dimension || embeddingDimension;

  try {
    // 检查向量表是否已存在
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'vectors'
      )
    `);

    if (tableCheck.rows[0].exists) {
      // 表已存在，检查维度
      const currentDim = await getVectorsTableDimension();
      if (currentDim === dim) {
        console.log(`向量表已存在，维度: ${dim}`);
        return dim;
      } else {
        console.log(`向量表维度不匹配 (${currentDim} -> ${dim})，需要重建`);
        await pool.query('DROP TABLE vectors');
      }
    }

    // 创建新的 vectors 表
    await pool.query(`
      CREATE TABLE vectors (
        image_id INTEGER PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
        embedding vector(${dim}) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建向量索引（HNSW 索引，适合高维向量）
    await pool.query(`
      CREATE INDEX IF NOT EXISTS vectors_embedding_idx ON vectors
      USING hnsw (embedding vector_cosine_ops)
    `);

    console.log(`向量表已创建，维度: ${dim}`);
    return dim;
  } catch (e) {
    console.error('创建向量表失败:', e.message);
    throw e;
  }
}

/**
 * 检查向量表的维度
 */
async function getVectorsTableDimension() {
  try {
    const result = await pool.query(`
      SELECT a.atttypmod
      FROM pg_attribute a
      JOIN pg_class c ON a.attrelid = c.oid
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = 'vectors'
        AND a.attname = 'embedding'
        AND n.nspname = 'public'
    `);

    if (result.rows.length > 0) {
      // atttypmod 包含维度信息，格式为 varattrib
      // 对于 vector(n)，我们需要查询维度
      const dimResult = await pool.query(`
        SELECT
          (SELECT regexp_matches(t.typname, 'vector\\(([0-9]+)\\')))[1]::int as dimension
        FROM pg_attribute a
        JOIN pg_type t ON a.atttypid = t.oid
        JOIN pg_class c ON a.attrelid = c.oid
        WHERE c.relname = 'vectors' AND a.attname = 'embedding'
      `);

      if (dimResult.rows.length > 0 && dimResult.rows[0].dimension) {
        return dimResult.rows[0].dimension;
      }
    }
    return null;
  } catch (e) {
    console.error('获取向量表维度失败:', e.message);
    return null;
  }
}

/**
 * 初始化数据库
 */
async function initDatabase() {
  try {
    // 测试数据库连接
    await pool.query('SELECT NOW()');
    console.log('数据库连接成功');

    // 初始化 pgvector 扩展
    await initVectorExtension();

    const database = getDatabase();

    // 创建用户表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        description TEXT,
        role VARCHAR(50) DEFAULT 'user',
        status INTEGER DEFAULT 1,
        quota INTEGER DEFAULT 100,
        valid_from DATE,
        valid_until DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建分类表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parent_id INTEGER NULL REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建图片表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        thumbnail_path VARCHAR(500),
        file_size INTEGER NOT NULL,
        file_format VARCHAR(50) NOT NULL,
        width INTEGER,
        height INTEGER,
        description TEXT,
        keywords TEXT,
        extracted_text TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        uploaded_by INTEGER NOT NULL REFERENCES users(id),
        is_favorite INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建标签表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建图片标签关联表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS image_tags (
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (image_id, tag_id)
      )
    `);

    // 创建操作日志表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        target_type VARCHAR(50),
        target_id INTEGER,
        details TEXT,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建收藏表
    await database.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, image_id)
      )
    `);

    // 创建向量表（使用 pgvector）
    await createVectorsTable(embeddingDimension);

    // 初始化默认管理员账号
    const adminExists = await database.prepare('SELECT id FROM users WHERE username = $1').get('admin');
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await database.prepare(
        "INSERT INTO users (username, password_hash, name, role, status, quota) VALUES ($1, $2, $3, 'admin', 1, 0) RETURNING id"
      ).run('admin', passwordHash, '系统管理员');
      console.log('默认管理员账号已创建: admin / admin123');
    }

    // 初始化默认分类
    const categoryCount = await database.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (!categoryCount || categoryCount.count === 0) {
      const categories = [
        { name: '风景', children: ['自然风光', '城市景观'] },
        { name: '人物', children: ['肖像', '生活', '工作'] },
        { name: '动物', children: ['宠物', '野生动物'] },
        { name: '建筑', children: ['现代建筑', '古典建筑', '室内'] },
        { name: '美食', children: ['中餐', '西餐', '甜点'] },
        { name: '物品', children: ['电子产品', '家居', '服饰'] },
        { name: '艺术', children: ['绘画', '设计', '摄影'] },
        { name: '其他', children: [] }
      ];

      for (const cat of categories) {
        const result = await database.prepare('INSERT INTO categories (name, parent_id) VALUES ($1, NULL) RETURNING id').run(cat.name);
        const parentId = result.lastInsertRowid;
        for (const childName of cat.children) {
          await database.prepare('INSERT INTO categories (name, parent_id) VALUES ($1, $2)').run(childName, parentId);
        }
      }
      console.log('默认分类已创建');
    }

    // 创建上传目录
    const uploadDir = path.join(__dirname, '../../uploads');
    const thumbnailDir = path.join(uploadDir, 'thumbnails');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    console.log('数据库初始化完成');
    return database;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接池
 */
async function closeDatabase() {
  await pool.end();
  console.log('数据库连接池已关闭');
}

module.exports = {
  getDatabase,
  initDatabase,
  closeDatabase,
  getEmbeddingDimension,
  setEmbeddingDimension,
  createVectorsTable,
  getVectorsTableDimension,
  pool
};