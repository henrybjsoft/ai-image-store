const { getDatabase } = require('../models/database');

async function logAction(userId, action, targetType = null, targetId = null, details = null, ipAddress = null) {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO logs (user_id, action, target_type, target_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, action, targetType, targetId, details, ipAddress);
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

function getLogs(filters = {}) {
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
}

function getLogCount(filters = {}) {
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

module.exports = {
  logAction,
  getLogs,
  getLogCount
};