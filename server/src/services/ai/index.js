/**
 * AI 服务统一入口
 * 根据配置选择不同的 AI 提供商（DashScope 或 Ollama）
 */
const DashScopeProvider = require('./dashscope');
const OllamaProvider = require('./ollama');

// AI 提供商类型
const AI_PROVIDERS = {
  DASHSCOPE: 'dashscope',
  OLLAMA: 'ollama'
};

// 当前 provider 实例（单例）
let currentProvider = null;
let currentProviderType = null;

/**
 * 获取当前配置的 AI Provider 实例
 * @returns {import('./base')}
 */
function getProvider() {
  const providerType = (process.env.AI_PROVIDER || 'dashscope').toLowerCase();

  // 如果 provider 类型没有变化，返回现有实例
  if (currentProvider && currentProviderType === providerType) {
    return currentProvider;
  }

  // 创建新的 provider 实例
  switch (providerType) {
    case AI_PROVIDERS.OLLAMA:
      currentProvider = new OllamaProvider({
        baseUrl: process.env.OLLAMA_BASE_URL,
        visionModel: process.env.OLLAMA_VISION_MODEL,
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL
      });
      break;

    case AI_PROVIDERS.DASHSCOPE:
    default:
      currentProvider = new DashScopeProvider({
        apiKey: process.env.DASHSCOPE_API_KEY,
        visionModel: process.env.DASHSCOPE_VISION_MODEL || process.env.AI_VISION_MODEL,
        embeddingModel: process.env.DASHSCOPE_EMBEDDING_MODEL || process.env.AI_EMBEDDING_MODEL
      });
      break;
  }

  currentProviderType = providerType;
  console.log(`[AI Service] 初始化 Provider: ${providerType}`);

  return currentProvider;
}

/**
 * 获取当前 AI 提供商类型
 * @returns {string}
 */
function getProviderType() {
  return (process.env.AI_PROVIDER || 'dashscope').toLowerCase();
}

/**
 * 获取当前配置信息（用于系统信息展示）
 * @returns {object}
 */
function getConfig() {
  const provider = getProvider();
  return provider.getConfig();
}

/**
 * 检查 AI 服务是否可用
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
  const provider = getProvider();
  return provider.isAvailable();
}

/**
 * 重置 provider 实例（用于配置变更后重新初始化）
 */
function resetProvider() {
  currentProvider = null;
  currentProviderType = null;
}

module.exports = {
  getProvider,
  getProviderType,
  getConfig,
  isAvailable,
  resetProvider,
  AI_PROVIDERS
};