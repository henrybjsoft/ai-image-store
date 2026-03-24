<template>
  <div class="images-page">
    <!-- 顶部筛选栏 -->
    <div class="filter-bar">
      <div class="filter-left">
        <div class="total-count" v-if="pagination.total > 0">
          共 <span class="count-number">{{ pagination.total }}</span> 张图片
        </div>
        <a-tree-select
          v-model:value="selectedCategory"
          :tree-data="categoryTree"
          placeholder="选择分类"
          allow-clear
          class="filter-select"
          @change="handleFilter"
        />
        <a-select
          v-model:value="selectedTag"
          placeholder="选择标签"
          allow-clear
          class="filter-select small"
          @change="handleFilter"
        >
          <a-select-option v-for="tag in tags" :key="tag.id" :value="tag.id">
            {{ tag.name }}
          </a-select-option>
        </a-select>
        <a-input
          v-model:value="keyword"
          placeholder="搜索..."
          class="filter-search"
          @pressEnter="handleFilter"
        >
          <template #prefix>
            <SearchOutlined class="search-icon" @click="handleFilter" />
          </template>
        </a-input>
        <a-button class="reset-btn" @click="handleReset">
          <ReloadOutlined /> 重置
        </a-button>
      </div>

      <div class="filter-right">
        <a-checkbox
          :checked="isAllSelected"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          class="select-all-checkbox"
        >
          全选
        </a-checkbox>
        <div class="view-toggle">
          <div
            class="toggle-btn"
            :class="{ active: viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <AppstoreOutlined />
          </div>
          <div
            class="toggle-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            <UnorderedListOutlined />
          </div>
        </div>
        <a-button
          type="primary"
          :disabled="selectedIds.length === 0"
          class="action-btn"
          @click="handleBatchDownload"
        >
          <DownloadOutlined /> 下载 ({{ selectedIds.length }})
        </a-button>
        <a-button
          danger
          :disabled="selectedIds.length === 0"
          class="action-btn danger"
          @click="handleBatchDelete"
        >
          <DeleteOutlined /> 删除
        </a-button>
      </div>
    </div>

    <!-- 图片网格 -->
    <div v-if="viewMode === 'grid'" class="image-grid">
      <div
        v-for="image in images"
        :key="image.id"
        class="image-card"
        :class="{ selected: selectedIds.includes(image.id) }"
      >
        <div class="image-checkbox" @click.stop="toggleSelect(image.id)">
          <a-checkbox :checked="selectedIds.includes(image.id)" />
        </div>
        <div class="image-wrapper" @click="handlePreview(image)">
          <img :src="getImageUrl(image)" :alt="image.original_name" />
          <div class="image-overlay">
            <div class="overlay-actions">
              <div class="action-item" @click.stop="handleFavorite(image)">
                <HeartFilled v-if="image.is_favorite" class="favorited" />
                <HeartOutlined v-else />
              </div>
              <div class="action-item" @click.stop="handleDownload(image)">
                <DownloadOutlined />
              </div>
              <div class="action-item delete" v-if="canDelete(image)" @click.stop="handleDelete(image)">
                <DeleteOutlined />
              </div>
            </div>
          </div>
        </div>
        <div class="image-info">
          <div class="image-name" :title="image.original_name">{{ image.original_name }}</div>
          <div class="image-meta">
            <span class="category-badge" v-if="image.category_name">{{ image.category_name }}</span>
            <span class="size">{{ formatSize(image.file_size) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片列表 -->
    <div v-else class="image-list">
      <div
        v-for="image in images"
        :key="image.id"
        class="list-item"
        :class="{ selected: selectedIds.includes(image.id) }"
      >
        <a-checkbox
          :checked="selectedIds.includes(image.id)"
          @change="toggleSelect(image.id)"
          class="item-checkbox"
        />
        <img :src="getImageUrl(image)" class="item-thumb" />
        <div class="item-info">
          <div class="item-name">{{ image.original_name }}</div>
          <div class="item-desc">{{ image.description || '暂无描述' }}</div>
        </div>
        <div class="item-category">
          <span class="category-badge" v-if="image.category_name">{{ image.category_name }}</span>
        </div>
        <div class="item-size">{{ formatSize(image.file_size) }}</div>
        <div class="item-date">{{ formatDate(image.created_at) }}</div>
        <div class="item-actions">
          <a-button type="text" size="small" @click="handlePreview(image)">
            <EyeOutlined />
          </a-button>
          <a-button type="text" size="small" @click="handleFavorite(image)">
            <HeartFilled v-if="image.is_favorite" style="color: #ef4444" />
            <HeartOutlined v-else />
          </a-button>
          <a-button type="text" size="small" @click="handleDownload(image)">
            <DownloadOutlined />
          </a-button>
          <a-button type="text" size="small" danger v-if="canDelete(image)" @click="handleDelete(image)">
            <DeleteOutlined />
          </a-button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="images.length === 0 && !loading" class="empty-state">
      <a-empty description="暂无图片">
        <a-button type="primary" @click="$router.push('/upload')">上传图片</a-button>
      </a-empty>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="pagination.total > 0">
      <a-pagination
        v-model:current="pagination.current"
        v-model:pageSize="pagination.pageSize"
        :total="pagination.total"
        show-size-changer
        :show-total="total => `共 ${total} 张`"
      />
    </div>

    <!-- 图片详情弹窗 -->
    <ImageDetail
      v-model:visible="previewVisible"
      :image="previewImage"
      :is-admin="userStore.isAdmin"
      :current-user-id="userStore.user?.id"
      @delete="handleDeleteRefresh"
      @reanalyze="handleReanalyzeRefresh"
    />

    </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  AppstoreOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  HeartOutlined,
  HeartFilled,
  DownloadOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { searchApi } from '@/api/search'
import ImageDetail from '@/components/ImageDetail.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const userStore = useUserStore()

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

// 全选相关计算属性
const isAllSelected = computed(() => {
  return images.value.length > 0 && selectedIds.value.length === images.value.length
})

const isIndeterminate = computed(() => {
  return selectedIds.value.length > 0 && selectedIds.value.length < images.value.length
})

// 全选/取消全选
function handleSelectAll(e) {
  if (e.target.checked) {
    selectedIds.value = images.value.map(img => img.id)
  } else {
    selectedIds.value = []
  }
}

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
})

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
  // 读取URL中的keyword参数
  if (route.query.keyword) {
    keyword.value = route.query.keyword
  }
  await loadImages()
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

function handleReset() {
  selectedCategory.value = null
  selectedTag.value = null
  keyword.value = ''
  pagination.current = 1
  loadImages()
}

function toggleSelect(id) {
  const index = selectedIds.value.indexOf(id)
  if (index > -1) {
    selectedIds.value.splice(index, 1)
  } else {
    selectedIds.value.push(id)
  }
}

function getImageUrl(image, full = false) {
  if (!full && image.thumbnail_path) {
    return `/uploads/${image.thumbnail_path}`
  }
  return `/uploads/${image.file_path}`
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

// 判断是否可以删除：管理员可删除任何图片，普通用户只能删除自己的图片
function canDelete(image) {
  if (userStore.isAdmin) return true
  if (userStore.user?.id && image.uploaded_by === userStore.user.id) return true
  return false
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

async function handleDownload(image) {
  try {
    const res = await imageApi.download(image.id)
    const blob = new Blob([res])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = image.original_name
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    message.error('下载失败')
  }
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

function handleDeleteRefresh() {
  loadImages()
}

function handleReanalyzeRefresh() {
  // 图片信息已在组件内更新
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
  Modal.confirm({
    title: '确定删除？',
    content: `将删除选中的 ${selectedIds.value.length} 张图片，删除后可在回收站恢复`,
    okText: '确定',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      try {
        await imageApi.batchDelete(selectedIds.value)
        message.success('已移入回收站')
        selectedIds.value = []
        loadImages()
      } catch (error) {
        message.error('删除失败')
      }
    }
  })
}

watch(() => pagination.current, () => loadImages())
watch(() => pagination.pageSize, () => loadImages())

// 监听URL中keyword参数变化
watch(() => route.query.keyword, (newKeyword) => {
  if (newKeyword !== keyword.value) {
    keyword.value = newKeyword || ''
    pagination.current = 1
    loadImages()
  }
})
</script>

<style scoped>
.images-page {
  animation: fadeIn 0.3s ease;
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.total-count {
  font-size: 14px;
  color: #64748b;
  padding: 6px 14px;
  background: #f1f5f9;
  border-radius: 8px;
  font-weight: 500;
}

.count-number {
  color: #6366f1;
  font-weight: 600;
}

.filter-select {
  width: 180px;
}

.filter-select.small {
  width: 140px;
}

.filter-search {
  width: 200px;
  background: #f1f5f9;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.filter-search:hover {
  background: #e8ecf2;
}

.filter-search:focus,
.filter-search :deep(.ant-input:focus) {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.filter-search :deep(.ant-input) {
  background: transparent;
  height: 30px !important;
  line-height: 30px !important;
  padding-left: 8px;
}

.filter-search :deep(.ant-input-prefix) {
  margin-right: 8px;
}

.filter-search .search-icon {
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.filter-search .search-icon:hover {
  color: #6366f1;
}

.reset-btn {
  margin-left: 8px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select-all-checkbox {
  margin-right: 8px;
  color: #64748b;
  font-weight: 500;
}

.view-toggle {
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 4px;
}

.toggle-btn {
  width: 36px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s ease;
}

.toggle-btn.active {
  background: white;
  color: #6366f1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 图片网格 */
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
  position: relative;
  border: 2px solid transparent;
}

.image-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}

.image-card.selected {
  border-color: #6366f1;
}

.image-checkbox {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
}

.image-checkbox :deep(.ant-checkbox-wrapper) {
  color: white;
}

.image-checkbox :deep(.ant-checkbox-inner) {
  background: rgba(255, 255, 255, 0.3);
  border-color: rgba(255, 255, 255, 0.5);
}

.image-checkbox :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background: #6366f1;
  border-color: #6366f1;
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

.action-item .favorited {
  color: #ef4444;
}

.action-item.delete {
  color: #ef4444;
}

.action-item.delete:hover {
  background: #fee2e2;
  color: #dc2626;
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
  margin-bottom: 8px;
}

.image-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-badge {
  font-size: 12px;
  color: #6366f1;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 4px;
}

.size {
  font-size: 12px;
  color: #94a3b8;
}

/* 图片列表 */
.image-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.list-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.list-item.selected {
  border-color: #6366f1;
  background: #f8faff;
}

.item-checkbox {
  flex-shrink: 0;
}

.item-thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  font-weight: 500;
  color: #1e293b;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-category {
  width: 100px;
}

.item-size {
  width: 80px;
  text-align: right;
  color: #64748b;
  font-size: 13px;
}

.item-date {
  width: 140px;
  color: #64748b;
  font-size: 13px;
}

.item-actions {
  display: flex;
  gap: 4px;
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 32px;
  padding: 20px;
  background: white;
  border-radius: 16px;
}

/* 空状态 */
.empty-state {
  padding: 60px 20px;
  text-align: center;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>