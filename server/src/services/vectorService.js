const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const VECTOR_FILE = path.join(DATA_DIR, 'vectors.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化向量索引
function initVectorIndex() {
  if (!fs.existsSync(VECTOR_FILE)) {
    fs.writeFileSync(VECTOR_FILE, JSON.stringify({}));
  }
  console.log('向量索引初始化完成');
}

// 添加图片向量
async function addImageVector(imageId, embedding, metadata = {}) {
  initVectorIndex();

  const vectors = loadVectors();
  vectors[imageId] = {
    embedding,
    metadata,
    createdAt: new Date().toISOString()
  };

  saveVectors(vectors);
  return imageId;
}

// 删除图片向量
async function removeImageVector(imageId) {
  const vectors = loadVectors();
  delete vectors[imageId];
  saveVectors(vectors);
}

// 加载向量数据
function loadVectors() {
  try {
    if (fs.existsSync(VECTOR_FILE)) {
      const data = fs.readFileSync(VECTOR_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('加载向量数据失败:', e);
  }
  return {};
}

// 保存向量数据
function saveVectors(vectors) {
  fs.writeFileSync(VECTOR_FILE, JSON.stringify(vectors, null, 2));
}

// 搜索相似向量
function searchSimilar(embedding, k = 10) {
  const vectors = loadVectors();
  const similarities = [];

  for (const [imageId, data] of Object.entries(vectors)) {
    if (data.embedding) {
      const similarity = cosineSimilarity(embedding, data.embedding);
      similarities.push({
        imageId: parseInt(imageId),
        distance: 1 - similarity // 转换为距离（越小越相似）
      });
    }
  }

  // 按距离排序，取前 k 个
  similarities.sort((a, b) => a.distance - b.distance);
  return similarities.slice(0, k);
}

// 计算余弦相似度
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 根据图片 ID 获取向量
function getVectorByImageId(imageId) {
  const vectors = loadVectors();
  return vectors[imageId]?.embedding || null;
}

// 重建索引（从数据库恢复）
async function rebuildIndex() {
  const { getDatabase } = require('../models/database');
  const { getEmbedding } = require('./aiService');

  const db = getDatabase();
  const images = db.prepare('SELECT id, description FROM images WHERE is_deleted = 0').all();

  // 清空现有索引
  const vectors = {};

  for (const image of images) {
    if (image.description) {
      try {
        const embedding = await getEmbedding(image.description);
        vectors[image.id] = {
          embedding,
          metadata: {},
          createdAt: new Date().toISOString()
        };
      } catch (error) {
        console.error(`重建索引失败 - 图片 ${image.id}:`, error);
      }
    }
  }

  saveVectors(vectors);
  console.log(`重建索引完成，共 ${Object.keys(vectors).length} 张图片`);
}

module.exports = {
  initVectorIndex,
  addImageVector,
  removeImageVector,
  searchSimilar,
  getVectorByImageId,
  rebuildIndex
};