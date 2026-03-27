/**
 * MinIO 对象存储实现
 */
const Minio = require('minio');
const StorageProvider = require('./base');

class MinioStorageProvider extends StorageProvider {
  constructor(config) {
    super();
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port || 9000,
      useSSL: config.useSSL !== false,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });
    this.bucket = config.bucket || 'images';
    this.publicUrl = config.publicUrl;
    this.initialized = false;
  }

  /**
   * 初始化存储桶
   */
  async init() {
    if (this.initialized) return;

    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        // 设置公开访问策略
        const policy = {
          Version: '2012-10-17',
          Statement: [{
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`]
          }]
        };
        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
        console.log(`MinIO bucket "${this.bucket}" created with public access`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('MinIO 初始化失败:', error.message);
      throw error;
    }
  }

  async uploadBuffer(buffer, key, options = {}) {
    await this.init();
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': options.contentType || 'application/octet-stream'
    });
    return { key, url: this.getUrl(key) };
  }

  async uploadFile(localFilePath, key, options = {}) {
    await this.init();
    const fs = require('fs');
    const stat = fs.statSync(localFilePath);
    await this.client.fPutObject(this.bucket, key, localFilePath, {
      'Content-Type': options.contentType || 'application/octet-stream'
    });
    return { key, url: this.getUrl(key) };
  }

  async getStream(key) {
    await this.init();
    return this.client.getObject(this.bucket, key);
  }

  async getBuffer(key) {
    await this.init();
    const stream = await this.getStream(key);
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  getUrl(key) {
    return `${this.publicUrl}/${key}`;
  }

  async delete(key) {
    await this.init();
    await this.client.removeObject(this.bucket, key);
  }

  async deleteMany(keys) {
    await this.init();
    await this.client.removeObjects(this.bucket, keys.map(k => ({ name: k })));
  }

  async exists(key) {
    await this.init();
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  getType() {
    return 'minio';
  }
}

module.exports = MinioStorageProvider;