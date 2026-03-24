const { LogRepository } = require('../repository');

async function logAction(userId, action, targetType = null, targetId = null, details = null, ipAddress = null) {
  try {
    LogRepository.create(userId, action, targetType, targetId, details, ipAddress);
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}

function getLogs(filters = {}) {
  return LogRepository.findList(filters);
}

function getLogCount(filters = {}) {
  return LogRepository.count(filters);
}

module.exports = {
  logAction,
  getLogs,
  getLogCount
};