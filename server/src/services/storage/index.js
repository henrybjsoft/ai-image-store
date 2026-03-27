/**
 * 存储服务统一入口
 * 根据配置选择存储提供商
 */
const LocalStorageProvider = require('./local');
const MinioStorageProvider = require('./minio');

let storageProvider = null;

/**
 * 初始化存储服务
 * @returns {StorageProvider}
 */
function initStorage() {
  const storageType = process.env.STORAGE_TYPE || 'local';

  console.log(`初始化存储服务: ${storageType}`);

  if (storageType === 'minio') {
    storageProvider = new MinioStorageProvider({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      bucket: process.env.MINIO_BUCKET || 'images',
      publicUrl: process.env.MINIO_PUBLIC_URL
    });
  } else {
    storageProvider = new LocalStorageProvider({
      baseDir: process.env.LOCAL_STORAGE_DIR,
      baseUrl: process.env.LOCAL_STORAGE_BASE_URL || '/uploads'
    });
  }

  return storageProvider;
}

/**
 * 获取存储实例
 * @returns {StorageProvider}
 */
function getStorage() {
  if (!storageProvider) {
    throw new Error('Storage not initialized. Call initStorage() first.');
  }
  return storageProvider;
}

/**
 * 判断是否使用本地存储
 * @returns {boolean}
 */
function isLocalStorage() {
  return storageProvider && storageProvider.getType() === 'local';
}

module.exports = {
  initStorage,
  getStorage,
  isLocalStorage
};