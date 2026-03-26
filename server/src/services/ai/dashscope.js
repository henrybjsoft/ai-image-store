/**
 * DashScope AI Provider 实现
 * 支持通义千问视觉模型和文本嵌入模型
 */
const AIProvider = require('./base');
const fs = require('fs');
const path = require('path');
const https = require('https');

class DashScopeProvider extends AIProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.DASHSCOPE_API_KEY;
    this.visionModel = config.visionModel || process.env.DASHSCOPE_VISION_MODEL || 'qwen-vl-plus';
    this.embeddingModel = config.embeddingModel || process.env.DASHSCOPE_EMBEDDING_MODEL || 'text-embedding-v3';
  }

  /**
   * 获取图片的 Base64 编码
   * @param {string|Buffer} imageInput - 文件路径或 Buffer
   */
  _getImageBase64(imageInput) {
    let imageBuffer;
    let ext = 'jpg';

    if (Buffer.isBuffer(imageInput)) {
      imageBuffer = imageInput;
    } else {
      imageBuffer = fs.readFileSync(imageInput);
      ext = path.extname(imageInput).toLowerCase().slice(1);
    }

    const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  }

  /**
   * 通用的 HTTPS POST 请求
   */
  _httpsPost(hostname, requestPath, body) {
    return new Promise((resolve, reject) => {
      const requestBody = JSON.stringify(body);
      const options = {
        hostname,
        port: 443,
        path: requestPath,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestBody)
        }
      };

      const req = https.request(options, (res) => {
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

      req.on('error', reject);
      req.write(requestBody);
      req.end();
    });
  }

  /**
   * 调用通义千问视觉模型
   */
  async _callVisionAPI(imageBase64, prompt) {
    const body = {
      model: this.visionModel,
      input: {
        messages: [
          {
            role: 'user',
            content: [
              { image: imageBase64 },
              { text: prompt }
            ]
          }
        ]
      }
    };
    return this._httpsPost('dashscope.aliyuncs.com', '/api/v1/services/aigc/multimodal-generation/generation', body);
  }

  /**
   * 调用 Embedding API
   */
  async _callEmbeddingAPI(text) {
    const body = {
      model: this.embeddingModel,
      input: { texts: [text] },
      parameters: { text_type: 'document' }
    };
    return this._httpsPost('dashscope.aliyuncs.com', '/api/v1/services/embeddings/text-embedding/text-embedding', body);
  }

  /**
   * 构建分类列表文本
   */
  _buildCategoryList(categories) {
    if (!categories || categories.length === 0) {
      return '其他';
    }

    // 构建分类树结构
    const rootCategories = categories.filter(c => !c.parent_id);
    const lines = [];

    for (const root of rootCategories) {
      const children = categories.filter(c => c.parent_id === root.id);
      if (children.length > 0) {
        lines.push(`- ${root.name}（包含：${children.map(c => c.name).join('、')}）`);
      } else {
        lines.push(`- ${root.name}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 分析图片
   */
  async analyzeImage(imagePath, categories = []) {
    const defaultResult = {
      description: '图片素材',
      keywords: ['图片', '素材'],
      extractedText: '',
      categoryName: '其他'
    };

    try {
      if (!this.apiKey || this.apiKey === 'your-dashscope-api-key') {
        return defaultResult;
      }

      const imageBase64 = this._getImageBase64(imagePath);
      const categoryList = this._buildCategoryList(categories);

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

4. 分类：请从以下分类中选择最合适的一个（只输出分类名称，不要输出父分类）：
${categoryList}

请严格按照以下JSON格式返回：
{"description": "详细描述内容", "keywords": ["关键词1", "关键词2", "关键词3"], "text": "图片中的文字内容，没有则为空字符串", "category": "分类名称"}`;

      console.log('[DashScope] 调用视觉模型分析图片...');
      const response = await this._callVisionAPI(imageBase64, prompt);

      if (response.code || response.message) {
        console.error('[DashScope] API 错误:', response.code, response.message);
        return defaultResult;
      }

      // 解析响应 - content 可能是数组 [{text: "..."}] 或字符串
      let content = '';
      if (response.output?.choices?.[0]?.message?.content) {
        const rawContent = response.output.choices[0].message.content;
        if (Array.isArray(rawContent)) {
          content = rawContent.map(item => item.text || '').join('');
        } else if (typeof rawContent === 'string') {
          content = rawContent;
        }
      } else if (response.output?.results?.[0]?.output?.text) {
        content = response.output.results[0].output.text;
      } else if (typeof response.output === 'string') {
        content = response.output;
      }

      // 解析 JSON 格式
      let description = '';
      let keywords = [];
      let extractedText = '';
      let categoryName = '其他';

      const jsonMatch = content.match(/\{[\s\S]*"description"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonResult = JSON.parse(jsonMatch[0]);
          description = jsonResult.description || '';
          keywords = jsonResult.keywords || [];
          extractedText = jsonResult.text || '';
          categoryName = jsonResult.category || jsonResult.categoryName || '其他';
        } catch (e) {
          console.log('[DashScope] JSON解析失败，尝试其他格式');
        }
      }

      // 如果 JSON 解析失败，尝试原有格式
      if (!description) {
        const descMatch = content.match(/描述[：:]\s*(.+?)(?=关键词|分类|$)/s);
        if (descMatch) {
          description = descMatch[1].trim();
        }
      }

      if (keywords.length === 0) {
        const keywordsMatch = content.match(/关键词[：:]\s*(.+?)(?=分类|$)/s);
        if (keywordsMatch) {
          keywords = keywordsMatch[1].split(/[,，、\s]+/).filter(k => k.trim()).map(k => k.trim());
        }
      }

      // 提取分类
      if (categoryName === '其他') {
        const categoryMatch = content.match(/分类[：:]\s*(.+?)(?=\n|$)/s);
        if (categoryMatch) {
          categoryName = categoryMatch[1].trim();
        }
      }

      // 如果解析失败，尝试直接使用内容
      if (!description && content) {
        description = content.substring(0, 200).trim();
      }

      if (keywords.length === 0) {
        keywords = ['图片', '素材'];
      }

      return { description, keywords, extractedText, categoryName };
    } catch (error) {
      console.error('[DashScope] 图片分析失败:', error.message);
      return defaultResult;
    }
  }

  /**
   * 获取文本的向量表示
   */
  async getEmbedding(text) {
    const defaultVector = () => new Array(1024).fill(0).map(() => Math.random() * 2 - 1);

    try {
      if (!this.apiKey || this.apiKey === 'your-dashscope-api-key') {
        return defaultVector();
      }

      const response = await this._callEmbeddingAPI(text);

      if (response.code || response.message) {
        console.error('[DashScope] Embedding API 错误:', response.code, response.message);
        return defaultVector();
      }

      return response.output?.embeddings?.[0]?.embedding || defaultVector();
    } catch (error) {
      console.error('[DashScope] 获取 Embedding 失败:', error.message);
      return defaultVector();
    }
  }

  /**
   * 获取当前配置信息（敏感信息打码）
   */
  getConfig() {
    const maskedKey = this.apiKey
      ? `${this.apiKey.substring(0, 8)}****${this.apiKey.substring(this.apiKey.length - 4)}`
      : '未配置';

    return {
      provider: 'dashscope',
      apiKey: maskedKey,
      visionModel: this.visionModel,
      embeddingModel: this.embeddingModel,
      embeddingDimension: this.getEmbeddingDimension()
    };
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable() {
    if (!this.apiKey || this.apiKey === 'your-dashscope-api-key') {
      return false;
    }
    return true;
  }

  /**
   * 获取嵌入向量的维度
   */
  getEmbeddingDimension() {
    // text-embedding-v3 默认输出 1024 维向量
    return 1024;
  }
}

module.exports = DashScopeProvider;