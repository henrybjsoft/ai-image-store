<template>
  <div class="favorites-page">
    <div class="page-header">
      <div class="header-content">
        <h2>我的收藏</h2>
        <p>收藏的图片会显示在这里</p>
      </div>
    </div>

    <div v-if="images.length > 0" class="image-grid">
      <div v-for="image in images" :key="image.id" class="image-card">
        <div class="image-wrapper" @click="handlePreview(image)">
          <img :src="getImageUrl(image)" :alt="image.original_name" />
          <div class="image-overlay">
            <div class="overlay-actions">
              <div class="action-item favorited" @click.stop="handleUnfavorite(image)">
                <HeartFilled />
              </div>
              <div class="action-item" @click.stop="handleDownload(image)">
                <DownloadOutlined />
              </div>
            </div>
          </div>
        </div>
        <div class="image-info">
          <div class="image-name">{{ image.original_name }}</div>
          <div class="image-meta">{{ formatSize(image.file_size) }}</div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <HeartOutlined />
      </div>
      <h3>暂无收藏</h3>
      <p>浏览图片时点击爱心即可收藏</p>
      <a-button type="primary" @click="$router.push('/images')">
        去浏览图片
      </a-button>
    </div>

    <!-- 预览弹窗 -->
    <a-modal v-model:open="previewVisible" :footer="null" width="80%" centered>
      <div class="preview-content" v-if="previewImage">
        <div class="preview-image">
          <img :src="getImageUrl(previewImage, true)" />
        </div>
        <div class="preview-sidebar">
          <h3>{{ previewImage.original_name }}</h3>
          <p class="preview-desc">{{ previewImage.description || '暂无描述' }}</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { HeartOutlined, HeartFilled, DownloadOutlined } from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'

const loading = ref(false)
const images = ref([])
const previewVisible = ref(false)
const previewImage = ref(null)

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
})

onMounted(() => {
  loadImages()
})

async function loadImages() {
  loading.value = true
  try {
    const res = await imageApi.getList({
      page: pagination.current,
      pageSize: pagination.pageSize,
      isFavorite: true
    })
    images.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function getImageUrl(image, full = false) {
  if (!full && image.thumbnail_path) {
    return `/uploads/${image.thumbnail_path}`
  }
  return `/uploads/${image.file_path}`
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function handlePreview(image) {
  previewImage.value = image
  previewVisible.value = true
}

async function handleUnfavorite(image) {
  try {
    await imageApi.toggleFavorite(image.id)
    message.success('已取消收藏')
    loadImages()
  } catch (error) {
    message.error('操作失败')
  }
}

function handleDownload(image) {
  const link = document.createElement('a')
  link.href = imageApi.download(image.id)
  link.download = image.original_name
  link.click()
}
</script>

<style scoped>
.favorites-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  margin-bottom: 24px;
}

.header-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.header-content p {
  color: #64748b;
  font-size: 14px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 20px;
}

.image-card {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.image-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.image-card:hover .image-wrapper img {
  transform: scale(1.08);
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.overlay-actions {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
}

.action-item {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1e293b;
}

.action-item:hover {
  background: white;
  transform: scale(1.1);
}

.action-item.favorited {
  color: #ef4444;
}

.image-info {
  padding: 16px;
}

.image-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.image-meta {
  font-size: 12px;
  color: #94a3b8;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  background: white;
  border-radius: 24px;
}

.empty-icon {
  font-size: 64px;
  color: #e2e8f0;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 8px;
}

.empty-state p {
  color: #64748b;
  margin-bottom: 24px;
}

.preview-content {
  display: flex;
  min-height: 60vh;
}

.preview-image {
  flex: 1;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.preview-image img {
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
}

.preview-sidebar {
  width: 280px;
  padding: 24px;
  background: white;
}

.preview-sidebar h3 {
  font-size: 18px;
  margin-bottom: 12px;
}

.preview-desc {
  color: #64748b;
  line-height: 1.6;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>