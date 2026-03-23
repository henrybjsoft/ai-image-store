<template>
  <div class="favorites-page">
    <a-page-header title="我的收藏" subtitle="收藏的图片会显示在这里" />

    <div class="image-grid">
      <div
        v-for="image in images"
        :key="image.id"
        class="image-card"
      >
        <div class="image-wrapper">
          <a-image
            :src="getImageUrl(image)"
            :preview="false"
            class="image-thumb"
            @click="handlePreview(image)"
          />
          <div class="image-overlay">
            <a-space>
              <a-button type="text" size="small" @click.stop="handleUnfavorite(image)">
                <HeartFilled style="color: #f5222d" />
              </a-button>
              <a-button type="text" size="small" @click.stop="handleDownload(image)">
                <DownloadOutlined />
              </a-button>
            </a-space>
          </div>
        </div>
        <div class="image-info">
          <div class="image-name">{{ image.original_name }}</div>
          <div class="image-meta">{{ formatSize(image.file_size) }}</div>
        </div>
      </div>
    </div>

    <a-empty v-if="images.length === 0 && !loading" description="暂无收藏" />

    <div class="pagination-wrapper" v-if="pagination.total > pagination.pageSize">
      <a-pagination
        v-model:current="pagination.current"
        :total="pagination.total"
        @change="loadImages"
      />
    </div>

    <!-- 图片预览弹窗 -->
    <a-modal v-model:open="previewVisible" :footer="null" width="80%" centered>
      <div v-if="previewImage" class="preview-content">
        <a-image :src="getImageUrl(previewImage, true)" style="max-width: 100%" />
        <div class="preview-info">
          <h3>{{ previewImage.original_name }}</h3>
          <p><strong>描述：</strong>{{ previewImage.description || '暂无' }}</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { HeartFilled, DownloadOutlined } from '@ant-design/icons-vue'
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
    return `/uploads/thumbnails/${image.thumbnail_path.split('/').pop()}`
  }
  return `/uploads/${image.file_path.split('/').slice(-2).join('/')}`
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
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.image-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  background: #f5f5f5;
  cursor: pointer;
}

.image-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
  opacity: 0;
  transition: opacity 0.3s;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.image-overlay .ant-btn {
  color: white;
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.image-meta {
  font-size: 12px;
  color: #999;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.preview-content {
  display: flex;
  gap: 24px;
}

.preview-info h3 {
  margin-bottom: 16px;
}
</style>