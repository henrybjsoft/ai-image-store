const fs = require('fs');
const path = require('path');
const https = require('https');
const { getDatabase } = require('../models/database');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;

// 获取图片的 Base64 编码
function getImageBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
}

// 通用的 HTTPS POST 请求
function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify(body);
    const options = {
      hostname,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
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

// 调用通义千问视觉模型
async function callQwenVL(imageBase64, prompt) {
  const body = {
    model: 'qwen-vl-plus',
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
  return httpsPost('dashscope.aliyuncs.com', '/api/v1/services/aigc/multimodal-generation/generation', body);
}

// 调用 Embedding API
async function callEmbeddingAPI(text) {
  const body = {
    model: 'text-embedding-v3',
    input: { texts: [text] },
    parameters: { text_type: 'document' }
  };
  return httpsPost('dashscope.aliyuncs.com', '/api/v1/services/embeddings/text-embedding/text-embedding', body);
}

// 根据关键词匹配分类
function matchCategory(keywords, description) {
  const db = getDatabase();
  const categories = db.prepare('SELECT * FROM categories').all();
  const text = (keywords.join(' ') + ' ' + description).toLowerCase();

  const categoryKeywords = {
    '风景': ['风景', '自然', '山水', '天空', '日落', '日出', '海洋', '森林', '山', '河', '湖', '花', '草地', '沙漠', '海滩', '雪', '云', '星空', '极光', '瀑布', '峡谷', '田野', '花园', '公园', '蓝天', '夕阳', '晨光', '自然风光', '户外'],
    '人物': ['人物', '人', '脸', '男人', '女人', '孩子', '儿童', '模特', '肖像', '团队', '人群', '肖像照', '自拍', '家庭', '情侣', '朋友', '老人', '青年', '少女', '男孩', '女孩', '微笑', '表情', '姿势'],
    '动物': ['动物', '猫', '狗', '鸟', '鱼', '宠物', '野生动物', '昆虫', '马', '兔', '老虎', '狮子', '熊猫', '蝴蝶', '蜜蜂', '海豚', '鲸鱼', '大象', '猴子', '松鼠', '鸽子', '天鹅', '小动物', '萌宠'],
    '建筑': ['建筑', '房子', '楼', '城市', '街道', '桥梁', '室内', '房间', '办公室', '博物馆', '教堂', '塔', '城堡', '摩天大楼', '住宅', '商场', '酒店', '学校', '医院', '现代建筑', '古典建筑', '建筑风格', '城市景观', '夜景'],
    '美食': ['美食', '食物', '餐', '水果', '蔬菜', '饮料', '咖啡', '蛋糕', '面包', '甜点', '餐厅', '料理', '海鲜', '肉类', '披萨', '汉堡', '寿司', '中餐', '西餐', '饮品', '茶', '酒', '冰淇淋', '巧克力'],
    '物品': ['物品', '产品', '商品', '工具', '家具', '电子', '车', '衣服', '包', '鞋', '手机', '电脑', '玩具', '书籍', '文具', '钟表', '眼镜', '珠宝', '化妆品', '家居', '装饰', '日用品', '办公用品'],
    '艺术': ['艺术', '绘画', '雕塑', '设计', '创意', '插画', '抽象', '图形', '纹理', '背景', '卡通', '动漫', '油画', '水彩', '素描', '摄影艺术', '数字艺术', '海报', '字体', '图案', '色彩', '视觉效果'],
    '其他': []
  };

  for (const category of categories) {
    if (!category.parent_id) {
      const keywordsList = categoryKeywords[category.name] || [];
      for (const kw of keywordsList) {
        if (text.includes(kw)) {
          const subCategories = categories.filter(c => c.parent_id === category.id);
          if (subCategories.length > 0) {
            return subCategories[0].id;
          }
          return category.id;
        }
      }
    }
  }

  const otherCategory = categories.find(c => c.name === '其他');
  return otherCategory ? otherCategory.id : null;
}

// 处理图片并返回 AI 分析结果
async function processImageWithAI(imagePath) {
  const defaultResult = {
    description: '图片素材',
    keywords: ['图片', '素材'],
    categoryId: null,
    extractedText: ''
  };

  try {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'your-dashscope-api-key') {
      return defaultResult;
    }

    const imageBase64 = getImageBase64(imagePath);
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

请严格按照以下JSON格式返回：
{"description": "详细描述内容", "keywords": ["关键词1", "关键词2", "关键词3"], "text": "图片中的文字内容，没有则为空字符串"}`;

    console.log('调用 AI 识别图片...');
    const response = await callQwenVL(imageBase64, prompt);
    console.log('AI 响应:', JSON.stringify(response).substring(0, 200));

    if (response.code || response.message) {
      console.error('DashScope API 错误:', response.code, response.message);
      return defaultResult;
    }

    // 解析响应 - content 可能是数组 [{text: "..."}] 或字符串
    let content = '';
    if (response.output?.choices?.[0]?.message?.content) {
      const rawContent = response.output.choices[0].message.content;
      if (Array.isArray(rawContent)) {
        // 数组格式：[{text: "描述：..."}]
        content = rawContent.map(item => item.text || '').join('');
      } else if (typeof rawContent === 'string') {
        content = rawContent;
      }
    } else if (response.output?.results?.[0]?.output?.text) {
      content = response.output.results[0].output.text;
    } else if (typeof response.output === 'string') {
      content = response.output;
    }

    console.log('AI 返回内容:', content);

    // 解析描述、关键词和文字
    let description = '';
    let keywords = [];
    let extractedText = '';

    // 尝试解析JSON格式
    const jsonMatch = content.match(/\{[\s\S]*"description"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const jsonResult = JSON.parse(jsonMatch[0]);
        description = jsonResult.description || '';
        keywords = jsonResult.keywords || [];
        extractedText = jsonResult.text || '';
      } catch (e) {
        console.log('JSON解析失败，尝试其他格式');
      }
    }

    // 如果JSON解析失败，尝试原有格式
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

    const categoryId = matchCategory(keywords, description);

    return { description, keywords, categoryId, extractedText };
  } catch (error) {
    console.error('AI 处理图片失败:', error.message);
    return defaultResult;
  }
}

// 获取文本的向量表示
async function getEmbedding(text) {
  const defaultVector = () => new Array(1024).fill(0).map(() => Math.random() * 2 - 1);

  try {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'your-dashscope-api-key') {
      return defaultVector();
    }

    const response = await callEmbeddingAPI(text);

    if (response.code || response.message) {
      console.error('Embedding API 错误:', response.code, response.message);
      return defaultVector();
    }

    return response.output?.embeddings?.[0]?.embedding || defaultVector();
  } catch (error) {
    console.error('获取 Embedding 失败:', error.message);
    return defaultVector();
  }
}

module.exports = {
  processImageWithAI,
  getEmbedding
};