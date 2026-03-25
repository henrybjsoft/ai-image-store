/**
 * AI Provider 抽象基类
 * 定义统一的 AI 服务接口，支持不同的 AI 提供商实现
 */
class AIProvider {
  constructor(config = {}) {
    this.config = config;
  }

  /**
   * 分析图片，返回描述、关键词、提取的文字
   * @param {string} imagePath - 图片文件路径
   * @returns {Promise<{description: string, keywords: string[], extractedText: string}>}
   */
  async analyzeImage(imagePath) {
    throw new Error('analyzeImage() must be implemented by subclass');
  }

  /**
   * 获取文本的向量表示
   * @param {string} text - 需要向量化的文本
   * @returns {Promise<number[]>} 向量数组
   */
  async getEmbedding(text) {
    throw new Error('getEmbedding() must be implemented by subclass');
  }

  /**
   * 获取当前配置信息（用于系统信息展示）
   * @returns {object} 配置信息（敏感信息打码）
   */
  getConfig() {
    throw new Error('getConfig() must be implemented by subclass');
  }

  /**
   * 检查服务是否可用
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable() must be implemented by subclass');
  }

  /**
   * 获取嵌入向量的维度
   * @returns {number}
   */
  getEmbeddingDimension() {
    throw new Error('getEmbeddingDimension() must be implemented by subclass');
  }
}

module.exports = AIProvider;