const path = require('path');
const fs = require('fs');
const { LocalDocumentIndex } = require('vectra');
const { getDatabase } = require('../models/database');

const DATA_DIR = path.join(__dirname, '../../data');
const VECTOR_INDEX_DIR = path.join(DATA_DIR, 'vector_index');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(VECTOR_INDEX_DIR)) {
  fs.mkdirSync(VECTOR_INDEX_DIR, { recursive: true });
}

let documentIndex = null;

// 初始化向量索引
async function initVectorIndex() {
  if (!documentIndex) {
    documentIndex = new LocalDocumentIndex({
      folderPath: VECTOR_INDEX_DIR,
      embeddings: {
        // 使用自定义嵌入函数
        maxTokens: 500,
        model: 'local'
      }
    });
    await documentIndex.initialize();
    console.log('向量索引初始化完成');
  }
  return documentIndex;
}

// 添加图片向量
async function addImageVector(imageId, embedding, metadata = {}) {
  const index = await initVectorIndex();

  // 将向量转换为文本描述（vectra 需要文本）
  const db = getDatabase();
  const image = db.prepare('SELECT description FROM images WHERE id = ?').get(imageId);

  const documentId = `image_${imageId}`;

  // 检查是否已存在，如果存在则先删除
  try {
    await index.deleteDocument(documentId);
  } catch (e) {
    // 文档不存在，忽略
  }

  // 添加文档
  await index.addDocument(documentId, image?.description || `Image ${imageId}`, {
    imageId,
    embedding: JSON.stringify(embedding),
    ...metadata
  });

  // 同时保存向量到单独文件（用于直接向量搜索）
  const vectorFile = path.join(DATA_DIR, 'vectors.json');
  let vectors = {};
  if (fs.existsSync(vectorFile)) {
    try {
      vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
    } catch (e) {
      vectors = {};
    }
  }
  vectors[imageId] = embedding;
  fs.writeFileSync(vectorFile, JSON.stringify(vectors));

  return documentId;
}

// 删除图片向量
async function removeImageVector(imageId) {
  const index = await initVectorIndex();
  const documentId = `image_${imageId}`;

  try {
    await index.deleteDocument(documentId);
  } catch (e) {
    // 文档不存在，忽略
  }

  // 从向量文件中删除
  const vectorFile = path.join(DATA_DIR, 'vectors.json');
  if (fs.existsSync(vectorFile)) {
    try {
      const vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
      delete vectors[imageId];
      fs.writeFileSync(vectorFile, JSON.stringify(vectors));
    } catch (e) {
      // 忽略错误
    }
  }
}

// 搜索相似向量
function searchSimilar(embedding, k = 10) {
  const vectorFile = path.join(DATA_DIR, 'vectors.json');

  if (!fs.existsSync(vectorFile)) {
    return [];
  }

  try {
    const vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
    const similarities = [];

    for (const [imageId, vec] of Object.entries(vectors)) {
      const similarity = cosineSimilarity(embedding, vec);
      similarities.push({
        imageId: parseInt(imageId),
        distance: 1 - similarity // 转换为距离（越小越相似）
      });
    }

    // 按距离排序，取前 k 个
    similarities.sort((a, b) => a.distance - b.distance);
    return similarities.slice(0, k);
  } catch (e) {
    console.error('搜索相似向量失败:', e);
    return [];
  }
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
  const vectorFile = path.join(DATA_DIR, 'vectors.json');

  if (!fs.existsSync(vectorFile)) {
    return null;
  }

  try {
    const vectors = JSON.parse(fs.readFileSync(vectorFile, 'utf8'));
    return vectors[imageId] || null;
  } catch (e) {
    return null;
  }
}

// 重建索引（从数据库恢复）
async function rebuildIndex() {
  const db = getDatabase();
  const images = db.prepare('SELECT id, description FROM images WHERE is_deleted = 0').all();

  // 清空现有索引
  const vectorFile = path.join(DATA_DIR, 'vectors.json');
  fs.writeFileSync(vectorFile, JSON.stringify({}));

  const { getEmbedding } = require('./aiService');

  for (const image of images) {
    if (image.description) {
      try {
        const embedding = await getEmbedding(image.description);
        await addImageVector(image.id, embedding);
      } catch (error) {
        console.error(`重建索引失败 - 图片 ${image.id}:`, error);
      }
    }
  }

  console.log(`重建索引完成，共 ${images.length} 张图片`);
}

module.exports = {
  initVectorIndex,
  addImageVector,
  removeImageVector,
  searchSimilar,
  getVectorByImageId,
  rebuildIndex
};