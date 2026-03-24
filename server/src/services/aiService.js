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
    '风景': ['风景', '自然', '山水', '天空', '日落', '日出', '海洋', '森林', '山', '河', '湖', '花', '草地', '沙漠', '海滩', '雪', '云'],
    '人物': ['人物', '人', '脸', '男人', '女人', '孩子', '儿童', '模特', '肖像', '团队', '人群', '肖像照', '自拍'],
    '动物': ['动物', '猫', '狗', '鸟', '鱼', '宠物', '野生动物', '昆虫', '马', '兔', '老虎', '狮子', '熊猫'],
    '建筑': ['建筑', '房子', '楼', '城市', '街道', '桥梁', '室内', '房间', '办公室', '博物馆', '教堂', '塔', '城堡'],
    '美食': ['美食', '食物', '餐', '水果', '蔬菜', '饮料', '咖啡', '蛋糕', '面包', '甜点', '餐厅', '料理'],
    '物品': ['物品', '产品', '商品', '工具', '家具', '电子', '车', '衣服', '包', '鞋', '手机', '电脑', '玩具'],
    '艺术': ['艺术', '绘画', '雕塑', '设计', '创意', '插画', '抽象', '图形', '纹理', '背景', '卡通', '动漫'],
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
    categoryId: null
  };

  try {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'your-dashscope-api-key') {
      return defaultResult;
    }

    const imageBase64 = getImageBase64(imagePath);
    const prompt = '请分析这张图片，用一句话描述图片内容（不超过50字），并列出3-5个关键词。直接返回结果，格式：描述：xxx 关键词：xxx,xxx,xxx';

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

    // 解析描述和关键词
    let description = '';
    let keywords = [];

    // 尝试匹配描述
    const descMatch = content.match(/描述[：:]\s*(.+?)(?=关键词|$)/s);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // 尝试匹配关键词
    const keywordsMatch = content.match(/关键词[：:]\s*(.+?)(?=$)/s);
    if (keywordsMatch) {
      keywords = keywordsMatch[1].split(/[,，、\s]+/).filter(k => k.trim()).map(k => k.trim());
    }

    // 如果解析失败，尝试直接使用内容
    if (!description && content) {
      description = content.substring(0, 100).trim();
    }

    if (keywords.length === 0) {
      keywords = ['图片', '素材'];
    }

    const categoryId = matchCategory(keywords, description);

    return { description, keywords, categoryId };
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