const { VectorRepository, ImageRepository } = require('../repository');
const { getEmbedding } = require('./aiService');

// 添加图片向量
async function addImageVector(imageId, embedding, userId = null) {
  VectorRepository.upsert(imageId, embedding, userId);
  return imageId;
}

// 删除图片向量
async function removeImageVector(imageId) {
  VectorRepository.delete(imageId);
}

// 搜索相似向量
function searchSimilar(embedding, k = 10, userId = null) {
  const vectors = VectorRepository.getAll(userId);
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
  return VectorRepository.get(imageId);
}

// 构建用于向量化的文本（描述+识别文字）
function buildEmbeddingText(description, extractedText) {
  let text = description || '';
  if (extractedText && extractedText.trim()) {
    text += ' 图片中的文字：' + extractedText.trim();
  }
  return text;
}

// 重建索引（从数据库恢复）
async function rebuildIndex() {
  const images = ImageRepository.findAllDescriptions();

  // 清空现有向量
  VectorRepository.clear();

  let count = 0;
  for (const image of images) {
    if (image.description) {
      try {
        const embedding = await getEmbedding(buildEmbeddingText(image.description, image.extracted_text));
        VectorRepository.upsert(image.id, embedding, image.uploaded_by);
        count++;
      } catch (error) {
        console.error(`重建索引失败 - 图片 ${image.id}:`, error);
      }
    }
  }

  console.log(`重建索引完成，共 ${count} 张图片`);
}

module.exports = {
  addImageVector,
  removeImageVector,
  searchSimilar,
  getVectorByImageId,
  rebuildIndex,
  buildEmbeddingText
};