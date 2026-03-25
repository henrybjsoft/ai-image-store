/**
 * Ollama AI Provider 实现
 * 支持本地部署的 Ollama 视觉模型和嵌入模型
 */
const AIProvider = require('./base');
const fs = require('fs');
const path = require('path');
const http = require('http');

class OllamaProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.visionModel = config.visionModel || process.env.OLLAMA_VISION_MODEL || 'llava';
    this.embeddingModel = config.embeddingModel || process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  /**
   * 发送 HTTP 请求到 Ollama
   */
  async _request(endpoint, body) {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const requestBody = JSON.stringify(body);

      const options = {
        hostname: url.hostname,
        port: url.port || 11434,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`解析响应失败: ${data}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Ollama 连接失败: ${e.message}`));
      });

      req.setTimeout(300000, () => { // 5分钟超时（视觉模型可能较慢）
        req.destroy();
        reject(new Error('Ollama 请求超时'));
      });

      req.write(requestBody);
      req.end();
    });
  }

  /**
   * 获取图片的 Base64 编码（不含 data:image/xxx;base64, 前缀）
   */
  _getImageBase64(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  /**
   * 调用 Ollama 视觉模型
   */
  async _callVisionAPI(imageBase64, prompt) {
    const body = {
      model: this.visionModel,
      prompt: prompt,
      images: [imageBase64],
      stream: false
    };
    return this._request('/api/generate', body);
  }

  /**
   * 调用 Ollama Embedding API
   */
  async _callEmbeddingAPI(text) {
    const body = {
      model: this.embeddingModel,
      prompt: text
    };
    return this._request('/api/embeddings', body);
  }

  /**
   * 分析图片
   */
  async analyzeImage(imagePath) {
    const defaultResult = {
      description: '图片素材',
      keywords: ['图片', '素材'],
      extractedText: ''
    };

    try {
      const imageBase64 = this._getImageBase64(imagePath);
      const prompt = `请详细分析这张图片，提供以下信息：

1. 详细描述：请用2-4句话详细描述图片的内容，包括：
   - 图片的主体内容是什么
   - 场景、环境、背景特点
   - 色彩、构图、风格特点
   - 图片传达的情感或氛围

2. 关键词：请列出8-15个关键词，包括：
   - 主体对象（人物、物品、动物等）
   - 场景环境（室内、室外、自然景观等）
   - 风格特点（现代、复古、简约等）
   - 色彩特点（暖色调、冷色调、鲜艳等）
   - 情感氛围（温馨、活力、宁静等）

3. 图片文字：请识别并提取图片中所有的文字内容，包括：
   - 标题、标语、品牌名称
   - 说明文字、注释
   - 水印、logo中的文字
   如果图片中没有文字，请返回空字符串

请严格按照以下JSON格式返回，不要包含其他任何文字：
{"description": "详细描述内容", "keywords": ["关键词1", "关键词2", "关键词3"], "text": "图片中的文字内容，没有则为空字符串"}`;

      console.log('[Ollama] 调用视觉模型分析图片...');
      const response = await this._callVisionAPI(imageBase64, prompt);

      if (response.error) {
        console.error('[Ollama] API 错误:', response.error);
        return defaultResult;
      }

      const content = response.response || '';

      // 解析 JSON 格式
      let description = '';
      let keywords = [];
      let extractedText = '';

      const jsonMatch = content.match(/\{[\s\S]*"description"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonResult = JSON.parse(jsonMatch[0]);
          description = jsonResult.description || '';
          keywords = jsonResult.keywords || [];
          extractedText = jsonResult.text || '';
        } catch (e) {
          console.log('[Ollama] JSON解析失败，尝试其他格式');
        }
      }

      // 如果 JSON 解析失败，尝试原有格式
      if (!description) {
        const descMatch = content.match(/描述[：:]\s*(.+?)(?=关键词|$)/s);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }

      if (keywords.length === 0) {
        const keywordsMatch = content.match(/关键词[：:]\s*(.+?)(?=$)/s);
        if (keywordsMatch) {
          keywords = keywordsMatch[1].split(/[,，、\s]+/).filter(k => k.trim()).map(k => k.trim());
        }
      }

      // 如果解析失败，尝试直接使用内容
      if (!description && content) {
        description = content.substring(0, 200).trim();
      }

      if (keywords.length === 0) {
        keywords = ['图片', '素材'];
      }

      return { description, keywords, extractedText };
    } catch (error) {
      console.error('[Ollama] 图片分析失败:', error.message);
      return defaultResult;
    }
  }

  /**
   * 获取文本的向量表示
   */
  async getEmbedding(text) {
    // 获取默认向量维度
    const dimension = this.getEmbeddingDimension();
    const defaultVector = () => new Array(dimension).fill(0).map(() => Math.random() * 2 - 1);

    try {
      const response = await this._callEmbeddingAPI(text);

      if (response.error) {
        console.error('[Ollama] Embedding API 错误:', response.error);
        return defaultVector();
      }

      return response.embedding || defaultVector();
    } catch (error) {
      console.error('[Ollama] 获取 Embedding 失败:', error.message);
      return defaultVector();
    }
  }

  /**
   * 获取当前配置信息
   */
  getConfig() {
    return {
      provider: 'ollama',
      baseUrl: this.baseUrl,
      visionModel: this.visionModel,
      embeddingModel: this.embeddingModel,
      embeddingDimension: this.getEmbeddingDimension()
    };
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable() {
    try {
      const url = new URL('/api/tags', this.baseUrl);
      return new Promise((resolve) => {
        http.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              // 检查是否有已安装的模型
              resolve(result.models && result.models.length > 0);
            } catch {
              resolve(false);
            }
          });
        }).on('error', () => {
          resolve(false);
        }).setTimeout(5000, () => {
          resolve(false);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * 获取嵌入向量的维度
   * 不同模型有不同的维度：
   * - nomic-embed-text: 768
   * - mxbai-embed-large: 1024
   * - all-minilm: 384
   */
  getEmbeddingDimension() {
    const dimensionMap = {
      'nomic-embed-text': 768,
      'mxbai-embed-large': 1024,
      'all-minilm': 384,
      'snowflake-arctic-embed': 1024,
      'bge-m3': 1024
    };

    // 如果模型名在映射表中，返回对应维度
    for (const [model, dim] of Object.entries(dimensionMap)) {
      if (this.embeddingModel.includes(model)) {
        return dim;
      }
    }

    // 默认返回 768（nomic-embed-text 的维度）
    return 768;
  }

  /**
   * 获取已安装的模型列表
   */
  async listModels() {
    try {
      const url = new URL('/api/tags', this.baseUrl);
      return new Promise((resolve, reject) => {
        http.get(url, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolve(result.models || []);
            } catch {
              reject(new Error('解析模型列表失败'));
            }
          });
        }).on('error', reject);
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = OllamaProvider;