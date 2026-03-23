<template>
  <div class="trash-page">
    <a-page-header title="回收站">
      <template #extra>
        <a-button :disabled="images.length === 0" @click="handleEmpty">
          清空回收站
        </a-button>
      </template>
    </a-page-header>

    <a-table
      :columns="columns"
      :data-source="images"
      :loading="loading"
      row-key="id"
      :row-selection="{ selectedRowKeys: selectedIds, onChange: setSelectedIds }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'preview'">
          <a-image :src="getImageUrl(record)" :width="60" :height="60" style="object-fit: cover" />
        </template>
        <template v-if="column.key === 'deletedAt'">
          {{ formatDate(record.deleted_at) }}
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="handleRestore([record.id])">恢复</a-button>
            <a-popconfirm title="确定彻底删除？此操作不可恢复" @confirm="handlePermanentDelete(record.id)">
              <a-button type="link" size="small" danger>彻底删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <div class="actions-bar" v-if="selectedIds.length > 0">
      <a-space>
        <a-button type="primary" @click="handleRestore(selectedIds)">
          恢复选中 ({{ selectedIds.length }})
        </a-button>
        <a-popconfirm title="确定彻底删除选中的图片？此操作不可恢复" @confirm="handleBatchPermanentDelete">
          <a-button danger>彻底删除选中</a-button>
        </a-popconfirm>
      </a-space>
    </div>

    <a-empty v-if="images.length === 0 && !loading" description="回收站为空" />

    <div class="pagination-wrapper" v-if="pagination.total > pagination.pageSize">
      <a-pagination
        v-model:current="pagination.current"
        :total="pagination.total"
        @change="loadImages"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import { trashApi } from '@/api/trash'

const loading = ref(false)
const images = ref([])
const selectedIds = ref([])

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
})

const columns = [
  { title: '预览', key: 'preview', width: 80 },
  { title: '文件名', dataIndex: 'original_name' },
  { title: '删除时间', key: 'deletedAt', width: 180 },
  { title: '操作', key: 'actions', width: 150 }
]

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
    return `/uploads/thumbnails/${image.thumbnail_path.split('/').pop()}`
  }
  return `/uploads/${image.file_path.split('/').slice(-2).join('/')}`
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function setSelectedIds(keys) {
  selectedIds.value = keys
}

async function handleRestore(ids) {
  try {
    await trashApi.restore(ids)
    message.success(`已恢复 ${ids.length} 张图片`)
    selectedIds.value = []
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

async function handleBatchPermanentDelete() {
  for (const id of selectedIds.value) {
    await trashApi.permanentDelete(id)
  }
  message.success('图片已彻底删除')
  selectedIds.value = []
  loadImages()
}

async function handleEmpty() {
  Modal.confirm({
    title: '确定清空回收站？',
    content: '此操作将永久删除所有回收站中的图片，不可恢复',
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
.actions-bar {
  margin-top: 16px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>