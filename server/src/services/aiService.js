const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getDatabase } = require('../models/database');

const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY;
const DASHSCOPE_API_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';
const DASHSCOPE_EMBEDDING_URL = 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

// 获取图片的 Base64 编码
function getImageBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
}

// 调用 DashScope API
async function callDashScopeAPI(messages) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'qwen-vl-plus',
      messages: messages,
      max_tokens: 1024
    });

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/api/v1/services/aigc/multimodal-generation/generation',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(requestBody);
    req.end();
  });
}

// 调用 Embedding API
async function callEmbeddingAPI(text) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: 'text-embedding-v3',
      input: {
        texts: [text]
      },
      parameters: {
        text_type: 'document'
      }
    });

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/api/v1/services/embeddings/text-embedding/text-embedding',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`解析响应失败: ${data}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(requestBody);
    req.end();
  });
}

// 根据关键词匹配分类
function matchCategory(keywords, description) {
  const db = getDatabase();
  const categories = db.prepare('SELECT * FROM categories').all();

  const text = (keywords.join(' ') + ' ' + description).toLowerCase();

  // 分类关键词映射
  const categoryKeywords = {
    '风景': ['风景', '自然', '山水', '天空', '日落', '日出', '海洋', '森林', '山', '河', '湖', '花', '草地', '沙漠'],
    '人物': ['人物', '人', '脸', '男人', '女人', '孩子', '儿童', '模特', '肖像', '团队', '人群'],
    '动物': ['动物', '猫', '狗', '鸟', '鱼', '宠物', '野生动物', '昆虫', '马', '兔'],
    '建筑': ['建筑', '房子', '楼', '城市', '街道', '桥梁', '室内', '房间', '办公室', '博物馆'],
    '美食': ['美食', '食物', '餐', '水果', '蔬菜', '饮料', '咖啡', '蛋糕', '面包', '甜点'],
    '物品': ['物品', '产品', '商品', '工具', '家具', '电子', '车', '衣服', '包', '鞋'],
    '艺术': ['艺术', '绘画', '雕塑', '设计', '创意', '插画', '抽象', '图形', '纹理', '背景'],
    '其他': []
  };

  // 遍历一级分类
  for (const category of categories) {
    if (!category.parent_id) {
      const keywordsList = categoryKeywords[category.name] || [];
      for (const kw of keywordsList) {
        if (text.includes(kw)) {
          // 查找该分类下的子分类
          const subCategories = categories.filter(c => c.parent_id === category.id);
          if (subCategories.length > 0) {
            // 简单返回第一个子分类或父分类
            return subCategories[0].id;
          }
          return category.id;
        }
      }
    }
  }

  // 默认返回"其他"分类
  const otherCategory = categories.find(c => c.name === '其他');
  return otherCategory ? otherCategory.id : null;
}

// 处理图片并返回 AI 分析结果
async function processImageWithAI(imagePath) {
  try {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'your-dashscope-api-key') {
      // 如果没有配置 API Key，返回模拟数据
      return {
        description: '图片描述（请配置 DashScope API Key 以启用 AI 识别）',
        keywords: ['图片', '素材'],
        categoryId: null
      };
    }

    const imageBase64 = getImageBase64(imagePath);

    const messages = [
      {
        role: 'user',
        content: [
          {
            image: imageBase64
          },
          {
            text: '请分析这张图片，提供以下信息：\n1. 详细描述图片内容（50字以内）\n2. 列出5-10个关键词（用逗号分隔）\n\n请按以下格式回复：\n描述：[图片描述]\n关键词：[关键词1,关键词2,关键词3]'
          }
        ]
      }
    ];

    const response = await callDashScopeAPI(messages);

    if (response.code) {
      console.error('DashScope API 错误:', response.message);
      return {
        description: '图片描述获取失败',
        keywords: ['图片'],
        categoryId: null
      };
    }

    const content = response.output?.choices?.[0]?.message?.content || '';
    console.log('AI 返回内容:', content);

    // 解析返回内容
    let description = '';
    let keywords = [];

    const descMatch = content.match(/描述[：:]\s*(.+?)(?=关键词|$)/s);
    const keywordsMatch = content.match(/关键词[：:]\s*(.+?)(?=$)/s);

    if (descMatch) {
      description = descMatch[1].trim();
    }

    if (keywordsMatch) {
      keywords = keywordsMatch[1].split(/[,，、\s]+/).filter(k => k.trim()).map(k => k.trim());
    }

    // 匹配分类
    const categoryId = matchCategory(keywords, description);

    return {
      description,
      keywords,
      categoryId
    };
  } catch (error) {
    console.error('AI 处理图片失败:', error);
    return {
      description: '图片描述获取失败',
      keywords: ['图片'],
      categoryId: null
    };
  }
}

// 获取文本的向量表示
async function getEmbedding(text) {
  try {
    if (!DASHSCOPE_API_KEY || DASHSCOPE_API_KEY === 'your-dashscope-api-key') {
      // 返回模拟向量
      return new Array(1024).fill(0).map(() => Math.random() * 2 - 1);
    }

    const response = await callEmbeddingAPI(text);

    if (response.code) {
      console.error('Embedding API 错误:', response.message);
      return new Array(1024).fill(0).map(() => Math.random() * 2 - 1);
    }

    return response.output?.embeddings?.[0]?.embedding || new Array(1024).fill(0).map(() => Math.random() * 2 - 1);
  } catch (error) {
    console.error('获取 Embedding 失败:', error);
    return new Array(1024).fill(0).map(() => Math.random() * 2 - 1);
  }
}

module.exports = {
  processImageWithAI,
  getEmbedding
};