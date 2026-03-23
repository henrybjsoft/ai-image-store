<template>
  <div class="images-page">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <a-space>
        <a-tree-select
          v-model:value="selectedCategory"
          :tree-data="categoryTree"
          placeholder="选择分类"
          allow-clear
          style="width: 200px"
          @change="handleFilter"
        />
        <a-select
          v-model:value="selectedTag"
          placeholder="选择标签"
          allow-clear
          style="width: 150px"
          @change="handleFilter"
        >
          <a-select-option v-for="tag in tags" :key="tag.id" :value="tag.id">
            {{ tag.name }}
          </a-select-option>
        </a-select>
        <a-input-search
          v-model:value="keyword"
          placeholder="关键字搜索"
          style="width: 200px"
          @search="handleFilter"
        />
        <a-button type="primary" @click="showSemanticSearch = true">
          语义搜索
        </a-button>
      </a-space>

      <a-space>
        <a-button @click="toggleViewMode">
          <template #icon>
            <AppstoreOutlined v-if="viewMode === 'list'" />
            <UnorderedListOutlined v-else />
          </template>
          {{ viewMode === 'grid' ? '列表' : '网格' }}
        </a-button>
        <a-button type="primary" :disabled="selectedIds.length === 0" @click="handleBatchDownload">
          <DownloadOutlined /> 批量下载 ({{ selectedIds.length }})
        </a-button>
        <a-button danger :disabled="selectedIds.length === 0" @click="handleBatchDelete">
          <DeleteOutlined /> 批量删除 ({{ selectedIds.length }})
        </a-button>
      </a-space>
    </div>

    <!-- 图片网格 -->
    <div v-if="viewMode === 'grid'" class="image-grid">
      <div
        v-for="image in images"
        :key="image.id"
        class="image-card"
        :class="{ selected: selectedIds.includes(image.id) }"
        @click="handleImageClick(image)"
      >
        <div class="image-wrapper">
          <a-checkbox
            :checked="selectedIds.includes(image.id)"
            @click.stop="toggleSelect(image.id)"
            class="image-checkbox"
          />
          <a-image
            :src="getImageUrl(image)"
            :preview="false"
            class="image-thumb"
          />
          <div class="image-overlay">
            <a-space>
              <a-button type="text" size="small" @click.stop="handlePreview(image)">
                <EyeOutlined />
              </a-button>
              <a-button type="text" size="small" @click.stop="handleFavorite(image)">
                <HeartFilled v-if="image.is_favorite" style="color: #f5222d" />
                <HeartOutlined v-else />
              </a-button>
              <a-button type="text" size="small" @click.stop="handleDownload(image)">
                <DownloadOutlined />
              </a-button>
            </a-space>
          </div>
        </div>
        <div class="image-info">
          <div class="image-name" :title="image.original_name">{{ image.original_name }}</div>
          <div class="image-meta">
            <span v-if="image.category_name">{{ image.category_name }}</span>
            <span>{{ formatSize(image.file_size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片列表 -->
    <a-table
      v-else
      :columns="columns"
      :data-source="images"
      :row-selection="{ selectedRowKeys: selectedIds, onChange: setSelectedIds }"
      :loading="loading"
      row-key="id"
      @row-click="handleRowClick"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'preview'">
          <a-image :src="getImageUrl(record)" :width="60" :height="60" style="object-fit: cover" />
        </template>
        <template v-if="column.key === 'name'">
          {{ record.original_name }}
        </template>
        <template v-if="column.key === 'category'">
          {{ record.category_name || '-' }}
        </template>
        <template v-if="column.key === 'size'">
          {{ formatSize(record.file_size) }}
        </template>
        <template v-if="column.key === 'createdAt'">
          {{ formatDate(record.created_at) }}
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click.stop="handlePreview(record)">预览</a-button>
            <a-button type="link" size="small" @click.stop="handleFavorite(record)">
              {{ record.is_favorite ? '取消收藏' : '收藏' }}
            </a-button>
            <a-button type="link" size="small" @click.stop="handleDownload(record)">下载</a-button>
            <a-popconfirm title="确定删除？" @confirm="handleDelete(record)">
              <a-button type="link" size="small" danger @click.stop>删除</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <a-pagination
        v-model:current="pagination.current"
        v-model:pageSize="pagination.pageSize"
        :total="pagination.total"
        show-size-changer
        show-quick-jumper
        @change="handlePageChange"
      />
    </div>

    <!-- 图片预览弹窗 -->
    <a-modal
      v-model:open="previewVisible"
      :footer="null"
      width="80%"
      centered
    >
      <div v-if="previewImage" class="preview-content">
        <a-image :src="getImageUrl(previewImage, true)" style="max-width: 100%" />
        <div class="preview-info">
          <h3>{{ previewImage.original_name }}</h3>
          <p><strong>描述：</strong>{{ previewImage.description || '暂无' }}</p>
          <p><strong>关键词：</strong>{{ previewImage.keywords?.join(', ') || '暂无' }}</p>
          <p><strong>分类：</strong>{{ previewImage.category_name || '未分类' }}</p>
          <p><strong>标签：</strong>
            <a-tag v-for="tag in previewImage.tags" :key="tag.id">{{ tag.name }}</a-tag>
            <span v-if="!previewImage.tags?.length">暂无</span>
          </p>
          <p><strong>大小：</strong>{{ formatSize(previewImage.file_size) }}</p>
          <p><strong>上传时间：</strong>{{ formatDate(previewImage.created_at) }}</p>
        </div>
      </div>
    </a-modal>

    <!-- 语义搜索弹窗 -->
    <a-modal
      v-model:open="showSemanticSearch"
      title="语义搜索"
      @ok="handleSemanticSearch"
    >
      <a-input
        v-model:value="semanticQuery"
        placeholder="输入自然语言描述，如：蓝色的风景照片"
      />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  HeartOutlined,
  HeartFilled,
  DownloadOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { searchApi } from '@/api/search'

const route = useRoute()

const loading = ref(false)
const images = ref([])
const categories = ref([])
const tags = ref([])
const selectedCategory = ref(null)
const selectedTag = ref(null)
const keyword = ref('')
const viewMode = ref('grid')
const selectedIds = ref([])
const previewVisible = ref(false)
const previewImage = ref(null)
const showSemanticSearch = ref(false)
const semanticQuery = ref('')

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
})

const columns = [
  { title: '预览', key: 'preview', width: 80 },
  { title: '名称', key: 'name' },
  { title: '分类', key: 'category', width: 120 },
  { title: '大小', key: 'size', width: 100 },
  { title: '上传时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 250 }
]

const categoryTree = computed(() => {
  const buildTree = (cats) => {
    return cats.map(cat => ({
      value: cat.id,
      title: cat.name,
      children: cat.children?.length ? buildTree(cat.children) : undefined
    }))
  }
  return buildTree(categories.value)
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadTags()])
  await loadImages()

  // 处理路由参数
  if (route.query.keyword) {
    keyword.value = route.query.keyword
    await loadImages()
  }
})

async function loadImages() {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      categoryId: selectedCategory.value,
      keyword: keyword.value || undefined
    }

    let res
    if (selectedTag.value) {
      res = await searchApi.byTag({ tagId: selectedTag.value, ...params })
    } else {
      res = await imageApi.getList(params)
    }

    images.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    console.error('加载图片失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  const res = await categoryApi.getTree()
  const flattenCats = (cats) => {
    let result = []
    cats.forEach(cat => {
      result.push(cat)
      if (cat.children?.length) {
        result = result.concat(flattenCats(cat.children))
      }
    })
    return result
  }
  categories.value = res.data || []
}

async function loadTags() {
  const res = await tagApi.getList()
  tags.value = res.data || []
}

function handleFilter() {
  pagination.current = 1
  loadImages()
}

function handlePageChange() {
  loadImages()
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
}

function toggleSelect(id) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function setSelectedIds(keys) {
  selectedIds.value = keys
}

function getImageUrl(image, full = false) {
  if (!full && image.thumbnail_path) {
    return `/uploads/thumbnails/${image.thumbnail_path.split('/').pop()}`
  }
  return `/uploads/${image.file_path.split('/').slice(-2).join('/')}`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function handleImageClick(image) {
  // 双击预览，单击选择
}

function handlePreview(image) {
  previewImage.value = image
  previewVisible.value = true
}

async function handleFavorite(image) {
  try {
    await imageApi.toggleFavorite(image.id)
    image.is_favorite = !image.is_favorite
    message.success(image.is_favorite ? '已收藏' : '已取消收藏')
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

async function handleDelete(image) {
  try {
    await imageApi.delete(image.id)
    message.success('已移入回收站')
    loadImages()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleBatchDownload() {
  try {
    const res = await imageApi.batchDownload(selectedIds.value)
    const blob = new Blob([res], { type: 'application/zip' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `images_${Date.now()}.zip`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载失败')
  }
}

async function handleBatchDelete() {
  try {
    await imageApi.batchDelete(selectedIds.value)
    message.success('已移入回收站')
    selectedIds.value = []
    loadImages()
  } catch (error) {
    message.error('删除失败')
  }
}

async function handleSemanticSearch() {
  if (!semanticQuery.value.trim()) {
    message.warning('请输入搜索内容')
    return
  }

  loading.value = true
  try {
    const res = await searchApi.semantic({
      query: semanticQuery.value,
      page: 1,
      pageSize: pagination.pageSize
    })
    images.value = res.data?.list || []
    pagination.total = res.data?.total || 0
    pagination.current = 1
    showSemanticSearch.value = false
  } catch (error) {
    message.error('搜索失败')
  } finally {
    loading.value = false
  }
}

// 监听路由查询参数
watch(() => route.query, (query) => {
  if (query.keyword) {
    keyword.value = query.keyword
    loadImages()
  }
}, { immediate: true })
</script>

<style scoped>
.images-page {
  min-height: 100%;
}

.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.image-card {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  cursor: pointer;
  border: 2px solid transparent;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.image-card.selected {
  border-color: #1890ff;
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  background: #f5f5f5;
}

.image-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
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
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.image-meta {
  font-size: 12px;
  color: #999;
  display: flex;
  justify-content: space-between;
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

.preview-info {
  flex: 1;
  min-width: 200px;
}

.preview-info h3 {
  margin-bottom: 16px;
  font-size: 18px;
}

.preview-info p {
  margin-bottom: 12px;
  color: #666;
}
</style>