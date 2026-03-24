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
          // 处理参数
          let paramList = params;
          if (params.length === 1 && Array.isArray(params[0])) {
            paramList = params[0];
          }

          try {
            db.run(sql, paramList);

            // 先获取 lastInsertRowid（在 saveDatabase 之前）
            const result = db.exec('SELECT last_insert_rowid() as id');
            const lastInsertRowid = result[0]?.values[0]?.[0] || 0;

            // 再保存数据库
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
    },
    pragma: () => {} // sql.js 不支持 WAL 模式，忽略
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

  // 加载或创建数据库
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const database = getDatabase();

  // 创建用户表
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
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

  // 创建图片表
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

  // 添加 extracted_text 列到 images 表（如果不存在）
  try {
    const columns = db.exec("PRAGMA table_info(images)");
    const columnNames = columns[0]?.values?.map(col => col[1]) || [];
    if (!columnNames.includes('extracted_text')) {
      database.exec('ALTER TABLE images ADD COLUMN extracted_text TEXT');
      console.log('已添加 extracted_text 列');
    }
  } catch (e) {
    console.log('添加 extracted_text 列失败或已存在');
  }

  // 创建向量表
  database.exec(`
    CREATE TABLE IF NOT EXISTS vectors (
      image_id INTEGER PRIMARY KEY,
      embedding TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    )
  `);

  // 添加向量表 user_id 字段
  try {
    const vectorColumns = db.exec("PRAGMA table_info(vectors)");
    const vectorColumnNames = vectorColumns[0]?.values?.map(col => col[1]) || [];
    if (!vectorColumnNames.includes('user_id')) {
      database.exec('ALTER TABLE vectors ADD COLUMN user_id INTEGER REFERENCES users(id)');
      console.log('已添加 vectors.user_id 列');
    }
  } catch (e) {
    console.log('添加 vectors.user_id 列失败或已存在');
  }

  // 添加用户表新字段
  const userColumns = db.exec("PRAGMA table_info(users)");
  const userColumnNames = userColumns[0]?.values?.map(col => col[1]) || [];

  if (!userColumnNames.includes('name')) {
    database.exec('ALTER TABLE users ADD COLUMN name TEXT');
  }
  if (!userColumnNames.includes('description')) {
    database.exec('ALTER TABLE users ADD COLUMN description TEXT');
  }
  if (!userColumnNames.includes('quota')) {
    database.exec('ALTER TABLE users ADD COLUMN quota INTEGER DEFAULT 100');
  }
  if (!userColumnNames.includes('status')) {
    database.exec('ALTER TABLE users ADD COLUMN status INTEGER DEFAULT 1');
  }
  if (!userColumnNames.includes('valid_from')) {
    database.exec('ALTER TABLE users ADD COLUMN valid_from DATE');
  }
  if (!userColumnNames.includes('valid_until')) {
    database.exec('ALTER TABLE users ADD COLUMN valid_until DATE');
  }
  if (!userColumnNames.includes('role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
  }

  // 初始化默认管理员账号
  const adminExists = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    database.prepare(
      "INSERT INTO users (username, password_hash, name, role, status, quota) VALUES (?, ?, ?, 'admin', 1, 0)"
    ).run('admin', passwordHash, '系统管理员');
    console.log('默认管理员账号已创建: admin / admin123');
  } else {
    // 确保 admin 用户有正确的 role
    database.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin' AND (role IS NULL OR role != 'admin')").run();
  }

  // 初始化默认分类
  const categoryCount = database.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (!categoryCount || categoryCount.count === 0) {
    const defaultCategories = [
      { name: '风景', parent_id: null },
      { name: '人物', parent_id: null },
      { name: '动物', parent_id: null },
      { name: '建筑', parent_id: null },
      { name: '美食', parent_id: null },
      { name: '物品', parent_id: null },
      { name: '艺术', parent_id: null },
      { name: '其他', parent_id: null }
    ];

    for (const cat of defaultCategories) {
      database.prepare('INSERT INTO categories (name, parent_id) VALUES (?, ?)').run(cat.name, cat.parent_id);
    }
    console.log('默认分类已创建');
  }

  console.log('数据库初始化完成');
  return database;
}

module.exports = {
  getDatabase,
  initDatabase
};