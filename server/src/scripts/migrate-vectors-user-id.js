/**
 * 迁移脚本：将现有向量的 user_id 设置为 admin 用户
 * 运行方式：node server/src/scripts/migrate-vectors-user-id.js
 */

const path = require('path');

// 设置数据目录
const DATA_DIR = path.join(__dirname, '../../data');

async function migrate() {
  // 动态导入数据库模块
  const { initDatabase } = require('../models/database');
  const db = await initDatabase();

  console.log('开始迁移向量数据...');

  try {
    // 1. 获取 admin 用户 ID
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!admin) {
      console.error('未找到 admin 用户');
      process.exit(1);
    }
    console.log(`Admin 用户 ID: ${admin.id}`);

    // 2. 获取所有现有向量
    const vectors = db.prepare('SELECT image_id FROM vectors WHERE user_id IS NULL').all();
    console.log(`找到 ${vectors.length} 条需要更新的向量记录`);

    if (vectors.length === 0) {
      console.log('没有需要更新的向量记录');
      return;
    }

    // 3. 批量更新
    const imageIds = vectors.map(v => v.image_id);
    const placeholders = imageIds.map(() => '?').join(',');

    const result = db.prepare(`UPDATE vectors SET user_id = ? WHERE image_id IN (${placeholders})`).run(admin.id, ...imageIds);

    console.log(`成功更新 ${result.changes} 条向量记录`);

    // 4. 验证
    const remaining = db.prepare('SELECT COUNT(*) as count FROM vectors WHERE user_id IS NULL').get();
    console.log(`剩余未设置的向量: ${remaining.count}`);

    console.log('迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});