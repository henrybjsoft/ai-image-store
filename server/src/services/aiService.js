/**
 * AI 服务模块
 * 提供图片分析和文本嵌入功能
 * 支持多种 AI 提供商（DashScope、Ollama）
 */
const { getProvider } = require('./ai');
const { getDatabase } = require('../models/database');

/**
 * 根据关键词匹配分类
 */
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

/**
 * 处理图片并返回 AI 分析结果
 * @param {string} imagePath - 图片文件路径
 * @returns {Promise<{description: string, keywords: string[], categoryId: number|null, extractedText: string}>}
 */
async function processImageWithAI(imagePath) {
  const provider = getProvider();

  try {
    const result = await provider.analyzeImage(imagePath);

    // 匹配分类
    const categoryId = matchCategory(result.keywords, result.description);

    return {
      description: result.description,
      keywords: result.keywords,
      categoryId,
      extractedText: result.extractedText
    };
  } catch (error) {
    console.error('AI 处理图片失败:', error.message);
    return {
      description: '图片素材',
      keywords: ['图片', '素材'],
      categoryId: null,
      extractedText: ''
    };
  }
}

/**
 * 获取文本的向量表示
 * @param {string} text - 需要向量化的文本
 * @returns {Promise<number[]>} 向量数组
 */
async function getEmbedding(text) {
  const provider = getProvider();

  try {
    return await provider.getEmbedding(text);
  } catch (error) {
    console.error('获取 Embedding 失败:', error.message);
    // 返回随机向量作为后备
    return new Array(1024).fill(0).map(() => Math.random() * 2 - 1);
  }
}

/**
 * 获取当前 AI 配置信息
 * @returns {object}
 */
function getAIConfig() {
  const provider = getProvider();
  return provider.getConfig();
}

/**
 * 检查 AI 服务是否可用
 * @returns {Promise<boolean>}
 */
async function isAIAvailable() {
  const provider = getProvider();
  return provider.isAvailable();
}

module.exports = {
  processImageWithAI,
  getEmbedding,
  getAIConfig,
  isAIAvailable,
  matchCategory
};