<template>
  <a-modal
    :open="visible"
    :footer="null"
    width="90%"
    centered
    class="image-detail-modal"
    @update:open="$emit('update:visible', $event)"
  >
    <div class="preview-container" v-if="image">
      <div class="preview-image">
        <img :src="getImageUrl(true)" />
        <div class="image-actions" v-if="showActions">
          <a-tooltip :title="image.is_favorite ? '取消收藏' : '收藏'">
            <div class="image-action-btn" :class="{ favorited: image.is_favorite }" @click="handleFavorite">
              <HeartFilled v-if="image.is_favorite" />
              <HeartOutlined v-else />
            </div>
          </a-tooltip>
          <a-tooltip title="删除" v-if="canDelete">
            <div class="image-action-btn delete" @click="handleDelete">
              <DeleteOutlined />
            </div>
          </a-tooltip>
        </div>
      </div>
      <div class="preview-sidebar">
        <div class="sidebar-header">
          <h3>{{ image.original_name }}</h3>
        </div>

        <div class="sidebar-content">
          <!-- 相似度（语义搜索场景） -->
          <div class="preview-section" v-if="similarity !== null">
            <div class="section-label">匹配度</div>
            <div class="similarity-bar">
              <div class="similarity-value" :style="{ width: (similarity * 100) + '%' }"></div>
            </div>
            <div class="similarity-text">{{ (similarity * 100).toFixed(2) }}%</div>
          </div>

          <div class="preview-section">
            <div class="section-label">描述</div>
            <div class="section-content">{{ image.description || '暂无描述' }}</div>
          </div>
          <div class="preview-section">
            <div class="section-label">关键词</div>
            <div class="section-tags">
              <a-tag v-for="kw in keywords" :key="kw">{{ kw }}</a-tag>
              <span v-if="keywords.length === 0" class="empty-text">暂无</span>
            </div>
          </div>
          <div class="preview-section" v-if="image.extracted_text">
            <div class="section-label">识别文字</div>
            <div class="section-content extracted-text">{{ image.extracted_text }}</div>
          </div>
          <div class="preview-section">
            <div class="section-label">分类</div>
            <div class="section-content">{{ image.category_name || '未分类' }}</div>
          </div>
          <div class="preview-section">
            <div class="section-label">标签</div>
            <div class="section-tags">
              <a-tag v-for="tag in (image.tags || [])" :key="tag.id" color="blue">{{ tag.name }}</a-tag>
              <span v-if="!image.tags?.length" class="empty-text">暂无</span>
            </div>
          </div>
          <div class="preview-section">
            <div class="section-label">文件信息</div>
            <div class="section-info">
              <div class="info-row">
                <span class="info-label">大小</span>
                <span class="info-value">{{ formatSize(image.file_size) }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">尺寸</span>
                <span class="info-value" v-if="image.width && image.height">{{ image.width }} × {{ image.height }}</span>
                <span class="info-value" v-else>-</span>
              </div>
              <div class="info-row">
                <span class="info-label">格式</span>
                <span class="info-value">{{ image.file_format?.toUpperCase() }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">上传者</span>
                <span class="info-value">{{ image.uploader_name || '未知' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">上传时间</span>
                <span class="info-value">{{ formatDate(image.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="sidebar-footer" v-if="showActions">
          <a-button type="primary" @click="handleDownload">
            <DownloadOutlined /> 下载
          </a-button>
          <a-button class="reanalyze-btn" :loading="reanalyzing" @click="handleReanalyze" v-if="canReanalyze">
            <template #icon><SyncOutlined /></template>
            重新识别
          </a-button>
        </div>
      </div>
    </div>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  HeartOutlined,
  HeartFilled,
  DownloadOutlined,
  DeleteOutlined,
  SyncOutlined
} from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  image: {
    type: Object,
    default: null
  },
  similarity: {
    type: Number,
    default: null
  },
  showActions: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  currentUserId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['update:visible', 'favorite', 'delete', 'reanalyze'])

const reanalyzing = ref(false)

// 解析关键词
const keywords = computed(() => {
  if (!props.image?.keywords) return []
  if (Array.isArray(props.image.keywords)) return props.image.keywords
  try {
    return JSON.parse(props.image.keywords)
  } catch {
    return []
  }
})

// 判断是否可以删除：管理员可删除任何图片，普通用户只能删除自己的图片
const canDelete = computed(() => {
  if (!props.image) return false
  // 管理员可以删除
  if (props.isAdmin) return true
  // 本人可以删除
  if (props.currentUserId && props.image.uploaded_by === props.currentUserId) return true
  return false
})

// 判断是否可以重新识别：仅管理员可用
const canReanalyze = computed(() => {
  return props.isAdmin
})

function getImageUrl(large = false) {
  if (!props.image) return ''
  if (!large && props.image.thumbnail_path) {
    return `/uploads/${props.image.thumbnail_path}`
  }
  return `/uploads/${props.image.file_path}`
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i]
}

function formatDate(date) {
  return date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
}

async function handleFavorite() {
  if (!props.image) return
  try {
    await imageApi.toggleFavorite(props.image.id)
    props.image.is_favorite = !props.image.is_favorite
    message.success(props.image.is_favorite ? '已收藏' : '已取消收藏')
    emit('favorite', props.image)
  } catch (error) {
    message.error('操作失败')
  }
}

async function handleDownload() {
  if (!props.image) return
  try {
    const res = await imageApi.download(props.image.id)
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = props.image.original_name
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载失败')
  }
}

function handleDelete() {
  if (!props.image) return
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除图片 "${props.image.original_name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await imageApi.delete(props.image.id)
        message.success('删除成功')
        emit('delete', props.image)
        emit('update:visible', false)
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

async function handleReanalyze() {
  if (!props.image) return
  reanalyzing.value = true
  try {
    const res = await imageApi.reanalyze(props.image.id)
    // 更新图片信息
    props.image.description = res.data.description
    props.image.keywords = res.data.keywords
    props.image.category_id = res.data.categoryId
    props.image.category_name = res.data.categoryName
    props.image.extracted_text = res.data.extractedText
    message.success('重新识别成功')
    emit('reanalyze', props.image)
  } catch (error) {
    message.error('重新识别失败')
  } finally {
    reanalyzing.value = false
  }
}
</script>

<style scoped>
.image-detail-modal :deep(.ant-modal-content) {
  padding: 0;
}

.preview-container {
  display: flex;
  height: 80vh;
}

.preview-image {
  flex: 1;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
}

.preview-image img {
  max-width: 100%;
  max-height: calc(80vh - 48px);
  object-fit: contain;
  border-radius: 8px;
}

.image-actions {
  position: absolute;
  bottom: 40px;
  right: 40px;
  display: flex;
  gap: 12px;
}

.image-action-btn {
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #64748b;
  font-size: 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.image-action-btn:hover {
  background: white;
  transform: scale(1.1);
}

.image-action-btn.favorited {
  color: #ef4444;
}

.image-action-btn.favorited:hover {
  background: #fee2e2;
}

.image-action-btn.delete {
  color: #ef4444;
}

.image-action-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.preview-sidebar {
  width: 420px;
  background: white;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.sidebar-header h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #1e293b;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.sidebar-footer {
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  background: white;
}

.preview-section {
  margin-bottom: 20px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.section-content {
  color: #1e293b;
  line-height: 1.6;
}

.extracted-text {
  background: #f0f9ff;
  border-left: 3px solid #0ea5e9;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
}

.section-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-text {
  color: #94a3b8;
  font-size: 13px;
}

.section-info {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
}

.info-label {
  color: #64748b;
  font-size: 13px;
}

.info-value {
  color: #1e293b;
  font-size: 13px;
  font-weight: 500;
}

.reanalyze-btn {
  min-width: 104px;
}

/* 相似度样式 */
.similarity-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.similarity-value {
  height: 100%;
  background: linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.similarity-text {
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;
}
</style>