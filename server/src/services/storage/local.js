/**
 * 本地文件系统存储实现
 */
const fs = require('fs');
const path = require('path');
const StorageProvider = require('./base');

class LocalStorageProvider extends StorageProvider {
  constructor(config = {}) {
    super();
    this.baseDir = config.baseDir || path.join(__dirname, '../../../uploads');
    this.baseUrl = config.baseUrl || '/uploads';
  }

  /**
   * 确保目录存在
   */
  _ensureDir(key) {
    const dir = path.dirname(path.join(this.baseDir, key));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async uploadBuffer(buffer, key, options = {}) {
    this._ensureDir(key);
    const filePath = path.join(this.baseDir, key);
    fs.writeFileSync(filePath, buffer);
    return { key, url: this.getUrl(key) };
  }

  async uploadFile(localFilePath, key, options = {}) {
    this._ensureDir(key);
    const destPath = path.join(this.baseDir, key);
    fs.copyFileSync(localFilePath, destPath);
    return { key, url: this.getUrl(key) };
  }

  async getStream(key) {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async getBuffer(key) {
    const filePath = path.join(this.baseDir, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  getUrl(key) {
    return `${this.baseUrl}/${key}`.replace(/\\/g, '/');
  }

  getAbsolutePath(key) {
    return path.join(this.baseDir, key);
  }

  async delete(key) {
    const filePath = path.join(this.baseDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async deleteMany(keys) {
    for (const key of keys) {
      try {
        await this.delete(key);
      } catch (error) {
        console.warn(`删除文件失败: ${key}`, error.message);
      }
    }
  }

  async exists(key) {
    const filePath = path.join(this.baseDir, key);
    return fs.existsSync(filePath);
  }

  getType() {
    return 'local';
  }

  /**
   * 获取上传目录路径（兼容现有代码）
   */
  getUploadDir() {
    return this.baseDir;
  }
}

module.exports = LocalStorageProvider;