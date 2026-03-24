<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in stats" :key="index">
        <div class="stat-icon" :style="{ background: stat.gradient }">
          <component :is="stat.icon" />
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="main-content">
      <!-- 最近上传 -->
      <div class="recent-section">
        <div class="section-header">
          <h3>最近上传</h3>
          <a-button type="link" @click="$router.push('/images')">
            查看全部 <RightOutlined />
          </a-button>
        </div>
        <div class="image-grid" v-if="recentImages.length > 0">
          <div
            v-for="image in recentImages"
            :key="image.id"
            class="image-card"
            @click="viewImage(image)"
          >
            <div class="image-wrapper">
              <img :src="getImageUrl(image)" :alt="image.original_name" />
              <div class="image-overlay">
                <EyeOutlined />
              </div>
            </div>
            <div class="image-info">
              <div class="image-name">{{ image.original_name }}</div>
              <div class="image-date">{{ formatDate(image.created_at) }}</div>
            </div>
          </div>
        </div>
        <a-empty v-else description="暂无图片" />
      </div>

      <!-- 快捷操作 -->
      <div class="quick-actions">
        <div class="section-header">
          <h3>快捷操作</h3>
        </div>
        <div class="action-grid">
          <div class="action-card" @click="$router.push('/upload')">
            <div class="action-icon upload">
              <CloudUploadOutlined />
            </div>
            <div class="action-info">
              <div class="action-title">上传图片</div>
              <div class="action-desc">批量上传，AI自动分类</div>
            </div>
          </div>
          <div class="action-card" @click="$router.push('/images')">
            <div class="action-icon browse">
              <PictureOutlined />
            </div>
            <div class="action-info">
              <div class="action-title">浏览图片</div>
              <div class="action-desc">按分类浏览全部图片</div>
            </div>
          </div>
          <div class="action-card" @click="$router.push('/categories')">
            <div class="action-icon category">
              <FolderOutlined />
            </div>
            <div class="action-info">
              <div class="action-title">管理分类</div>
              <div class="action-desc">添加或编辑分类</div>
            </div>
          </div>
          <div class="action-card" @click="$router.push('/tags')">
            <div class="action-icon tag">
              <TagsOutlined />
            </div>
            <div class="action-info">
              <div class="action-title">管理标签</div>
              <div class="action-desc">自定义图片标签</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  PictureOutlined,
  FolderOutlined,
  TagsOutlined,
  HeartOutlined,
  CloudUploadOutlined,
  RightOutlined,
  EyeOutlined
} from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'

const router = useRouter()
const loading = ref(false)

const stats = ref([
  { label: '图片总数', value: 0, icon: 'PictureOutlined', gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' },
  { label: '分类数量', value: 0, icon: 'FolderOutlined', gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' },
  { label: '标签数量', value: 0, icon: 'TagsOutlined', gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' },
  { label: '收藏数量', value: 0, icon: 'HeartOutlined', gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' },
])

const recentImages = ref([])

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [imagesRes, categoriesRes, tagsRes] = await Promise.all([
      imageApi.getList({ page: 1, pageSize: 6 }),
      categoryApi.getTree(),
      tagApi.getList()
    ])

    recentImages.value = imagesRes.data?.list || []
    stats.value[0].value = imagesRes.data?.total || 0

    // 计算分类数量
    let catCount = 0
    const countCategories = (cats) => {
      cats.forEach(cat => {
        catCount++
        if (cat.children?.length) countCategories(cat.children)
      })
    }
    countCategories(categoriesRes.data || [])
    stats.value[1].value = catCount

    stats.value[2].value = tagsRes.data?.length || 0

    // 获取收藏数
    const favRes = await imageApi.getList({ isFavorite: true, pageSize: 1 })
    stats.value[3].value = favRes.data?.total || 0
  } catch (error) {
    console.error('加载数据失败:', error)
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

function formatDate(date) {
  return dayjs(date).format('MM-DD HH:mm')
}

function viewImage(image) {
  router.push({ path: '/images', query: { id: image.id } })
}
</script>

<style scoped>
.dashboard {
  animation: fadeIn 0.3s ease;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.recent-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.image-card {
  border-radius: 12px;
  overflow: hidden;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.image-wrapper {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.image-card:hover .image-wrapper img {
  transform: scale(1.05);
}

.image-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s ease;
  color: white;
  font-size: 24px;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.image-info {
  padding: 12px;
}

.image-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-date {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

.quick-actions {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.action-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-card:hover {
  background: #f1f5f9;
  transform: translateX(4px);
}

.action-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
}

.action-icon.upload {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.action-icon.browse {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
}

.action-icon.category {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
}

.action-icon.tag {
  background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
}

.action-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.action-desc {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
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

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-content {
    grid-template-columns: 1fr;
  }
}
</style>