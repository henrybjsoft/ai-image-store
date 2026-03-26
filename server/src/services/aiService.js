/**
 * AI 服务模块
 * 提供图片分析和文本嵌入功能
 * 支持多种 AI 提供商（DashScope、Ollama）
 */
const { getProvider } = require('./ai');
const { CategoryRepository } = require('../repository');

/**
 * 根据分类名称查找分类 ID
 * @param {string} categoryName - AI 返回的分类名称
 * @param {Array} categories - 分类列表
 * @returns {number|null} 分类 ID
 */
function findCategoryIdByName(categoryName, categories) {
  if (!categoryName || categoryName === '其他') {
    const otherCategory = categories.find(c => c.name === '其他');
    return otherCategory ? otherCategory.id : null;
  }

  // 先精确匹配
  let category = categories.find(c => c.name === categoryName);
  if (category) {
    // 如果是父分类，返回第一个子分类
    if (!category.parent_id) {
      const subCategories = categories.filter(c => c.parent_id === category.id);
      if (subCategories.length > 0) {
        return subCategories[0].id;
      }
    }
    return category.id;
  }

  // 模糊匹配
  category = categories.find(c => c.name.includes(categoryName) || categoryName.includes(c.name));
  if (category) {
    if (!category.parent_id) {
      const subCategories = categories.filter(c => c.parent_id === category.id);
      if (subCategories.length > 0) {
        return subCategories[0].id;
      }
    }
    return category.id;
  }

  // 未找到，返回"其他"
  const otherCategory = categories.find(c => c.name === '其他');
  return otherCategory ? otherCategory.id : null;
}

/**
 * 处理图片并返回 AI 分析结果
 * @param {string|Buffer} imageInput - 图片文件路径或 Buffer
 * @returns {Promise<{description: string, keywords: string[], categoryId: number|null, extractedText: string}>}
 */
async function processImageWithAI(imageInput) {
  const provider = getProvider();

  try {
    // 获取所有分类，传递给 AI 进行分类判断
    const categories = await CategoryRepository.findAll();

    // 调用 AI 分析，传入分类列表
    const result = await provider.analyzeImage(imageInput, categories);

    // 根据 AI 返回的分类名称查找分类 ID
    const categoryId = findCategoryIdByName(result.categoryName, categories);

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
  isAIAvailable
};