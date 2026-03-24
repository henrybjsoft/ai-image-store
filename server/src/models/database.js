const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'database.db');

let db = null;

// 获取数据库实例
function getDatabase() {
  return {
    prepare: (sql) => {
      return {
        run: (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            db.run(sql, paramList);
            const result = db.exec('SELECT last_insert_rowid() as id');
            const lastInsertRowid = result[0]?.values[0]?.[0] || 0;
            saveDatabase();
            return { lastInsertRowid, changes: db.getRowsModified() };
          } catch (e) {
            console.error('SQL run error:', e, sql, paramList);
            throw e;
          }
        },
        get: (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            const stmt = db.prepare(sql);
            stmt.bind(paramList);
            if (stmt.step()) {
              const row = stmt.getAsObject();
              stmt.free();
              return row;
            }
            stmt.free();
            return undefined;
          } catch (e) {
            console.error('SQL get error:', e, sql, paramList);
            throw e;
          }
        },
        all: (...params) => {
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            const results = [];
            const stmt = db.prepare(sql);
            stmt.bind(paramList);
            while (stmt.step()) {
              results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
          } catch (e) {
            console.error('SQL all error:', e, sql, paramList);
            throw e;
          }
        }
      };
    },
    exec: (sql) => {
      db.run(sql);
      saveDatabase();
    }
  };
}

// 保存数据库到文件
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 确保数据目录存在
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 加载已有数据库或创建新数据库
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('数据库加载完成');
  } else {
    db = new SQL.Database();
    console.log('创建新数据库');
  }

  const database = getDatabase();

  // 创建用户表（包含所有字段）
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      description TEXT,
      role TEXT DEFAULT 'user',
      status INTEGER DEFAULT 1,
      quota INTEGER DEFAULT 100,
      valid_from DATE,
      valid_until DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建分类表
  database.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  // 创建图片表（包含所有字段）
  database.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT,
      file_size INTEGER NOT NULL,
      file_format TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      description TEXT,
      keywords TEXT,
      extracted_text TEXT,
      category_id INTEGER,
      uploaded_by INTEGER NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // 创建标签表
  database.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建图片标签关联表
  database.exec(`
    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (image_id, tag_id),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // 创建操作日志表
  database.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 创建向量表（包含所有字段）
  database.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      image_id INTEGER PRIMARY KEY,
      embedding TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 初始化默认管理员账号（仅当不存在时）
  const adminExists = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    database.prepare(
      "INSERT INTO users (username, password_hash, name, role, status, quota) VALUES (?, ?, ?, 'admin', 1, 0)"
    ).run('admin', passwordHash, '系统管理员');
    console.log('默认管理员账号已创建: admin / admin123');
  }

  // 初始化默认分类（仅当不存在时）
  const categoryCount = database.prepare('SELECT COUNT(*) as count FROM categories').get();
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
      const result = database.prepare('INSERT INTO categories (name, parent_id) VALUES (?, NULL)').run(cat.name);
      const parentId = result.lastInsertRowid;
      for (const childName of cat.children) {
        database.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(childName, parentId);
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
}

module.exports = {
  getDatabase,
  initDatabase
};