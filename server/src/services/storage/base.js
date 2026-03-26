/**
 * 存储抽象基类
 * 定义统一的存储接口
 */
class StorageProvider {
  /**
   * 上传 Buffer 数据
   * @param {Buffer} buffer - 文件数据
   * @param {string} key - 存储键名（相对路径）
   * @param {object} options - 可选配置 { contentType }
   * @returns {Promise<{key: string, url: string}>}
   */
  async uploadBuffer(buffer, key, options = {}) {
    throw new Error('uploadBuffer() must be implemented');
  }

  /**
   * 上传本地文件
   * @param {string} filePath - 本地文件路径
   * @param {string} key - 存储键名（相对路径）
   * @param {object} options - 可选配置 { contentType }
   * @returns {Promise<{key: string, url: string}>}
   */
  async uploadFile(filePath, key, options = {}) {
    throw new Error('uploadFile() must be implemented');
  }

  /**
   * 获取文件流
   * @param {string} key - 存储键名
   * @returns {Promise<Stream>}
   */
  async getStream(key) {
    throw new Error('getStream() must be implemented');
  }

  /**
   * 获取文件 Buffer
   * @param {string} key - 存储键名
   * @returns {Promise<Buffer>}
   */
  async getBuffer(key) {
    throw new Error('getBuffer() must be implemented');
  }

  /**
   * 获取访问 URL
   * @param {string} key - 存储键名
   * @returns {string}
   */
  getUrl(key) {
    throw new Error('getUrl() must be implemented');
  }

  /**
   * 删除文件
   * @param {string} key - 存储键名
   * @returns {Promise<void>}
   */
  async delete(key) {
    throw new Error('delete() must be implemented');
  }

  /**
   * 批量删除文件
   * @param {string[]} keys - 存储键名数组
   * @returns {Promise<void>}
   */
  async deleteMany(keys) {
    throw new Error('deleteMany() must be implemented');
  }

  /**
   * 检查文件是否存在
   * @param {string} key - 存储键名
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    throw new Error('exists() must be implemented');
  }

  /**
   * 获取存储类型标识
   * @returns {string}
   */
  getType() {
    throw new Error('getType() must be implemented');
  }
}

module.exports = StorageProvider;