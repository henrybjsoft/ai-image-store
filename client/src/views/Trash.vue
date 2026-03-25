<template>
  <div class="trash-page">
    <div class="page-header">
      <div class="header-content">
        <h2>回收站</h2>
        <p>已删除的图片会在 30 天后自动清理</p>
      </div>
      <a-button danger :disabled="images.length === 0" @click="handleEmpty">
        <DeleteOutlined /> 清空回收站
      </a-button>
    </div>

    <div v-if="images.length > 0" class="image-list">
      <div v-for="image in images" :key="image.id" class="list-item">
        <img :src="getImageUrl(image)" class="item-thumb" />
        <div class="item-info">
          <div class="item-name">{{ image.original_name }}</div>
          <div class="item-date">删除于 {{ formatDate(image.deleted_at) }}</div>
        </div>
        <div class="item-actions">
          <a-button type="primary" size="small" @click="handleRestore([image.id])">
            <UndoOutlined /> 恢复
          </a-button>
          <a-popconfirm title="彻底删除后无法恢复，确定？" @confirm="handlePermanentDelete(image.id)">
            <a-button danger size="small">彻底删除</a-button>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-icon">
        <DeleteOutlined />
      </div>
      <h3>回收站是空的</h3>
      <p>删除的图片会在这里显示</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons-vue'
import { trashApi } from '@/api/trash'
import { formatDate } from '@/utils/date'

const loading = ref(false)
const images = ref([])

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
    const res = await trashApi.getList({
      page: pagination.current,
      pageSize: pagination.pageSize
    })
    images.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function getImageUrl(image) {
  if (image.thumbnail_path) {
    return `/uploads/${image.thumbnail_path}`
  }
  return `/uploads/${image.file_path}`
}

async function handleRestore(ids) {
  try {
    await trashApi.restore(ids)
    message.success(`已恢复 ${ids.length} 张图片`)
    loadImages()
  } catch (error) {
    message.error('恢复失败')
  }
}

async function handlePermanentDelete(id) {
  try {
    await trashApi.permanentDelete(id)
    message.success('图片已彻底删除')
    loadImages()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleEmpty() {
  Modal.confirm({
    title: '确定清空回收站？',
    content: '此操作将永久删除所有图片，不可恢复',
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      try {
        await trashApi.empty()
        message.success('回收站已清空')
        loadImages()
      } catch (error) {
        message.error('操作失败')
      }
    }
  })
}
</script>

<style scoped>
.trash-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.image-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.list-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.item-thumb {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: cover;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 15px;
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.item-date {
  font-size: 13px;
  color: #94a3b8;
}

.item-actions {
  display: flex;
  gap: 8px;
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
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>