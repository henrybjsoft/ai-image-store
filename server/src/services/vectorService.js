const { VectorRepository } = require('../repository');

// 添加图片向量
async function addImageVector(imageId, embedding, userId = null) {
  await VectorRepository.upsert(imageId, embedding, userId);
  return imageId;
}

// 删除图片向量
async function removeImageVector(imageId) {
  await VectorRepository.delete(imageId);
}

// 搜索相似向量 - 使用 pgvector
async function searchSimilar(embedding, k = 10, userId = null) {
  return VectorRepository.searchSimilar(embedding, k, userId);
}

// 构建用于向量化的文本（描述+识别文字）
function buildEmbeddingText(description, extractedText) {
  let text = description || '';
  if (extractedText && extractedText.trim()) {
    text += ' 图片中的文字：' + extractedText.trim();
  }
  return text;
}

module.exports = {
  addImageVector,
  removeImageVector,
  searchSimilar,
  buildEmbeddingText
};