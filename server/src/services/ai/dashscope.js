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

  /**
   * 根据图片生成绘图提示词
   */
  async generatePrompt(imageInput) {
    const defaultResult = {
      positivePrompt: '',
      negativePrompt: '',
      textAndLayout: '',
      suggestions: {
        aspectRatio: '1:1',
        style: '通用'
      }
    };

    try {
      if (!this.apiKey || this.apiKey === 'your-dashscope-api-key') {
        throw new Error('DashScope API Key 未配置');
      }

      const imageBase64 = this._getImageBase64(imageInput);

      const prompt = `你是一个专业的AI绘图提示词专家。请仔细分析这张图片，生成非常详细的、可用于 Stable Diffusion、Midjourney 等 AI 绘图工具的中文提示词。

请从以下维度详细分析图片，并将分析结果融入提示词中：

【主体描述】
- 核心主体是什么（人物/动物/物品/场景）
- 主体的具体外观特征（如果是人物：年龄、性别、发型、发色、瞳色、面部特征、表情、姿态、动作等）
- 服装穿着（颜色、款式、材质、配饰等）
- 如果是场景：建筑风格、自然环境、天气状况等

【构图与视角】
- 镜头角度（俯视/仰视/平视/侧视）
- 景别（特写/半身/全身/远景/全景）
- 构图方式（居中/三分/对称/引导线等）
- 景深效果（背景虚化/清晰背景）

【光影效果】
- 光源类型（自然光/人工光/混合光）
- 光线方向和强度（侧光/逆光/顶光/柔光/硬光）
- 光影氛围（温暖/冷调/戏剧性/柔和）
- 特殊光效（丁达尔效应/体积光/光晕/反光）

【色彩特征】
- 主色调和配色方案
- 色彩饱和度和对比度
- 整体色彩氛围

【艺术风格】
- 整体风格定位（写实摄影/插画/动漫/油画/水彩/赛博朋克等）
- 艺术技法特点
- 参考艺术家或风格流派

【画质与细节】
- 清晰度和细节程度
- 分辨率要求
- 特殊质感表现

【文案与布局】（必须描述）
- 整体布局结构（上下结构/左右结构/中心辐射/网格布局/自由布局等）
- 视觉重心位置
- 主要元素的空间分布和层次关系
- 留白区域和比例
- 装饰元素的位置和作用
- 如果图片中有文字内容，还需描述：
  - 完整提取所有文字
  - 文字的语言类型（中文/英文/日文等）
  - 文字的语义表达（标题/口号/说明/装饰性文字等）
  - 文字的位置、字体风格、大小关系
  - 文字与图像的位置关系

请严格按照以下JSON格式返回（所有提示词必须使用中文，正向提示词要非常详细，包含上述多个维度的描述）：
{
  "positivePrompt": "详细的多维度正向提示词，必须包含主体、构图、光影、色彩、风格、画质等维度的描述。示例：一位年轻女性，约20岁，亚洲面孔，精致的面部特征，水汪汪的大眼睛，淡棕色瞳孔，淡妆，微微笑着的表情，黑色长发，发梢微卷，随风轻扬，身穿米白色针织毛衣，宽松版型，柔软质地，配戴细银项链，站在秋天的银杏大道上，金黄色的银杏叶铺满地面，阳光透过树叶洒下斑驳光影，温暖的午后光线，柔光效果，丁达尔效应，景深虚化背景，居中构图，半身特写，写实摄影风格，高画质，8K分辨率，细节丰富，电影级光影，温馨治愈的氛围",
  "negativePrompt": "反向提示词，描述你不希望出现的元素。示例：模糊，低质量，扭曲，变形，多余的手指，肢体畸形，文字，水印，低分辨率，噪点，过曝，欠曝",
  "textAndLayout": "详细描述图片的布局版式，如果有文字则同时描述文案内容。示例1（有文字）：图片采用上下分区布局，上部2/3为主视觉区域，展示产品主体居中放置。图片包含文字内容：主标题'春日物语'位于画面上方居中，使用优雅的宋体字，白色字体配深色阴影；副标题'春暖花开'位于主标题下方，字号较小。下部1/3为信息区域，左侧品牌logo，中间产品名称，右侧促销信息。整体视觉重心在中上部，四周留有适当留白。示例2（无文字）：图片采用中心对称布局，主体位于画面正中央，占据画面约60%的空间。背景为渐变色，从上方的深蓝色过渡到下方的浅蓝色。四周有大量留白，营造简约开阔的视觉效果。视觉重心明确集中在中央主体上，整体构图稳定平衡",
  "suggestions": {
    "aspectRatio": "推荐的画幅比例",
    "style": "推荐的风格类型"
  }
}`;

      console.log('[DashScope] 生成绘图提示词...');
      const response = await this._callVisionAPI(imageBase64, prompt);

      if (response.code || response.message) {
        console.error('[DashScope] API 错误:', response.code, response.message);
        throw new Error(response.message || 'API 调用失败');
      }

      // 解析响应
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

      // 解析 JSON
      const jsonMatch = content.match(/\{[\s\S]*"positivePrompt"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          return {
            positivePrompt: result.positivePrompt || defaultResult.positivePrompt,
            negativePrompt: result.negativePrompt || defaultResult.negativePrompt,
            textAndLayout: result.textAndLayout || '',
            suggestions: {
              aspectRatio: result.suggestions?.aspectRatio || defaultResult.suggestions.aspectRatio,
              style: result.suggestions?.style || defaultResult.suggestions.style
            }
          };
        } catch (e) {
          console.error('[DashScope] JSON解析失败:', e.message);
        }
      }

      throw new Error('无法解析提示词结果');
    } catch (error) {
      console.error('[DashScope] 生成提示词失败:', error.message);
      throw error;
    }
  }
}

module.exports = DashScopeProvider;