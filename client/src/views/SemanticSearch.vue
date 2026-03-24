<template>
  <div class="semantic-search">
    <!-- 搜索区域 -->
    <div class="search-section">
      <div class="search-header">
        <h2>语义搜索</h2>
        <p class="search-desc">使用自然语言描述你想要查找的图片，系统会根据语义相似度返回结果</p>
      </div>

      <div class="search-form">
        <a-textarea
          v-model:value="query"
          placeholder="例如：蓝色的风景照片、可爱的小动物、现代建筑..."
          :auto-size="{ minRows: 2, maxRows: 4 }"
          class="query-input"
          @keydown="handleKeydown"
        />

        <div class="search-options">
          <div class="option-item">
            <label>返回数量 (Top K)</label>
            <a-input-number
              v-model:value="topK"
              :min="1"
              :max="100"
              :step="10"
              class="topk-input"
            />
          </div>

          <div class="option-item">
            <label>分类筛选</label>
            <a-tree-select
              v-model:value="selectedCategory"
              :tree-data="categoryTree"
              placeholder="全部分类"
              allow-clear
              class="filter-select"
            />
          </div>

          <div class="option-item">
            <label>标签筛选</label>
            <a-select
              v-model:value="selectedTag"
              placeholder="全部标签"
              allow-clear
              class="filter-select"
            >
              <a-select-option v-for="tag in tags" :key="tag.id" :value="tag.id">
                {{ tag.name }}
              </a-select-option>
            </a-select>
          </div>

          <a-button type="primary" :loading="loading" @click="handleSearch" class="search-btn">
            <SearchOutlined /> 搜索
          </a-button>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div class="results-section" v-if="hasSearched">
      <div class="results-header">
        <div class="results-info">
          <span class="results-count">找到 <strong>{{ results.length }}</strong> 个结果</span>
          <span class="query-text" v-if="lastQuery">搜索词："{{ lastQuery }}"</span>
        </div>
        <div class="sort-tip">
          <ArrowDownOutlined /> 按匹配度排序
        </div>
      </div>

      <div class="results-grid" v-if="results.length > 0">
        <div
          v-for="item in results"
          :key="item.image.id"
          class="result-card"
        >
          <div class="image-wrapper" @click="showPreview(item)">
            <img :src="getImageUrl(item.image)" :alt="item.image.original_name" />
            <div class="image-overlay">
              <div class="overlay-actions">
                <div class="action-item" @click.stop="handleFavorite(item.image)">
                  <HeartFilled v-if="item.image.is_favorite" class="favorited" />
                  <HeartOutlined v-else />
                </div>
                <div class="action-item" @click.stop="handleDownload(item.image)">
                  <DownloadOutlined />
                </div>
                <div class="action-item delete" v-if="canDelete(item.image)" @click.stop="handleDelete(item.image)">
                  <DeleteOutlined />
                </div>
              </div>
            </div>
            <div class="similarity-badge">
              {{ (item.similarity * 100).toFixed(1) }}%
            </div>
          </div>
          <div class="image-info" @click="showPreview(item)">
            <div class="image-name">{{ item.image.original_name }}</div>
            <div class="image-meta">
              <span class="similarity">
                <BulbOutlined /> {{ (item.similarity * 100).toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <a-empty v-else description="没有找到相关图片" />
    </div>

    <!-- 初始状态提示 -->
    <div class="empty-state" v-else>
      <div class="empty-icon">
        <BulbOutlined />
      </div>
      <h3>开始语义搜索</h3>
      <p>输入自然语言描述，系统将根据图片内容的语义相似度返回结果</p>
    </div>

    <!-- 图片预览弹窗 -->
    <ImageDetail
      v-model:visible="previewVisible"
      :image="previewItem?.image"
      :similarity="previewItem?.similarity"
      :is-admin="userStore.isAdmin"
      :current-user-id="userStore.user?.id"
      @delete="handleDeleteRefresh"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  SearchOutlined,
  BulbOutlined,
  HeartOutlined,
  HeartFilled,
  DownloadOutlined,
  DeleteOutlined,
  ArrowDownOutlined
} from '@ant-design/icons-vue'
import { searchApi } from '@/api/search'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { imageApi } from '@/api/image'
import ImageDetail from '@/components/ImageDetail.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const loading = ref(false)
const hasSearched = ref(false)
const query = ref('')
const lastQuery = ref('')
const topK = ref(10)
const selectedCategory = ref(null)
const selectedTag = ref(null)
const categories = ref([])
const tags = ref([])
const results = ref([])

const previewVisible = ref(false)
const previewItem = ref(null)

// 分类树结构
const categoryTree = computed(() => {
  const buildTree = (items, parentId = null) => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        value: item.id,
        title: item.name,
        children: buildTree(items, item.id)
      }))
  }
  return buildTree(categories.value)
})

onMounted(async () => {
  await loadOptions()
})

async function loadOptions() {
  try {
    const [catRes, tagRes] = await Promise.all([
      categoryApi.getTree(),
      tagApi.getList()
    ])
    categories.value = catRes.data || []
    tags.value = tagRes.data || []
  } catch (error) {
    console.error('加载选项失败:', error)
  }
}

function handleKeydown(e) {
  if (e.key === 'Enter') {
    if (e.altKey || e.ctrlKey || e.shiftKey) {
      // Alt/Ctrl/Shift+Enter: 插入换行符
      e.preventDefault()
      const textarea = e.target
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const value = query.value || ''
      query.value = value.substring(0, start) + '\n' + value.substring(end)
      // 恢复光标位置
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    } else {
      // Enter: 阻止换行，执行搜索
      e.preventDefault()
      handleSearch()
    }
  }
}

async function handleSearch() {
  if (!query.value.trim()) {
    message.warning('请输入搜索内容')
    return
  }

  loading.value = true
  hasSearched.value = true

  try {
    const res = await searchApi.semantic({
      query: query.value.trim(),
      topK: topK.value,
      categoryId: selectedCategory.value,
      tagId: selectedTag.value
    })

    lastQuery.value = query.value.trim()

    // 处理结果，根据分类和标签筛选
    let list = res.data?.list || []

    if (selectedCategory.value) {
      list = list.filter(item => {
        const image = item.image || item
        return image.category_id === selectedCategory.value
      })
    }

    if (selectedTag.value) {
      list = list.filter(item => {
        const image = item.image || item
        return image.tags?.some(t => t.id === selectedTag.value)
      })
    }

    // 确保数据格式一致
    results.value = list.map(item => {
      if (item.image) {
        return item
      }
      // 如果返回的是直接图片对象
      return {
        image: item,
        similarity: item.similarity || 0
      }
    }).sort((a, b) => b.similarity - a.similarity)
  } catch (error) {
    console.error('语义搜索失败:', error)
    message.error('搜索失败')
  } finally {
    loading.value = false
  }
}

function getImageUrl(image, large = false) {
  if (!large && image.thumbnail_path) {
    return `/uploads/${image.thumbnail_path}`
  }
  return `/uploads/${image.file_path}`
}

function showPreview(item) {
  previewItem.value = item
  previewVisible.value = true
}

// 判断是否可以删除：管理员可删除任何图片，普通用户只能删除自己的图片
function canDelete(image) {
  if (userStore.isAdmin) return true
  if (userStore.user?.id && image.uploaded_by === userStore.user.id) return true
  return false
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
    results.value = results.value.filter(r => r.image.id !== image.id)
  } catch (error) {
    message.error('删除失败')
  }
}

function handleDeleteRefresh() {
  // 从结果列表中移除已删除的图片
  if (previewItem.value) {
    results.value = results.value.filter(r => r.image.id !== previewItem.value.image.id)
  }
}
</script>

<style scoped>
.semantic-search {
  animation: fadeIn 0.3s ease;
}

/* 搜索区域 */
.search-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.search-header {
  margin-bottom: 20px;
}

.search-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.search-desc {
  color: #64748b;
  font-size: 14px;
  margin: 0;
}

.search-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.query-input {
  border-radius: 10px;
  font-size: 15px;
}

.search-options {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.option-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-item label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.topk-input {
  width: 100px;
}

.filter-select {
  width: 160px;
}

.search-btn {
  height: 32px;
  padding: 0 20px;
}

/* 搜索结果 */
.results-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.results-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.results-count {
  font-size: 14px;
  color: #64748b;
}

.results-count strong {
  color: #1e293b;
  font-weight: 600;
}

.query-text {
  font-size: 13px;
  color: #94a3b8;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
}

.sort-tip {
  font-size: 13px;
  color: #6366f1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.result-card {
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.result-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
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
  transition: transform 0.3s ease;
}

.result-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.result-card:hover .image-overlay {
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
  padding: 12px;
  cursor: pointer;
}

.image-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.image-meta {
  display: flex;
  align-items: center;
}

.similarity {
  font-size: 12px;
  color: #6366f1;
  display: flex;
  align-items: center;
  gap: 4px;
}

.similarity-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 6px;
}

/* 空状态 */
.empty-state {
  background: white;
  border-radius: 16px;
  padding: 60px 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  font-size: 36px;
  color: white;
}

.empty-state h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1400px) {
  .results-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1100px) {
  .results-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 800px) {
  .results-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .search-options {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-select {
    width: 100%;
  }
}
</style>