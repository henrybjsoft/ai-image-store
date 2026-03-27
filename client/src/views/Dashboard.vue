<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in stats" :key="index">
        <div class="stat-icon" :style="{ background: stat.gradient }">
          <svg viewBox="0 0 24 24" class="stat-svg" v-html="stat.svgPath"></svg>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
        <div class="stat-decoration">
          <svg viewBox="0 0 100 100" class="decoration-svg">
            <circle cx="50" cy="50" r="45" fill="none" :stroke="stat.color" stroke-width="2" opacity="0.2"/>
            <circle cx="50" cy="50" r="30" fill="none" :stroke="stat.color" stroke-width="2" opacity="0.15"/>
            <circle cx="50" cy="50" r="15" fill="none" :stroke="stat.color" stroke-width="2" opacity="0.1"/>
          </svg>
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
            @click="showPreview(image)"
          >
            <div class="image-wrapper">
              <img :src="getImageUrl(image)" :alt="image.original_name" />
              <div class="image-overlay">
                <EyeOutlined />
              </div>
            </div>
            <div class="image-info">
              <div class="image-name">{{ image.original_name }}</div>
              <div class="image-date">{{ formatDate(image.created_at, 'MM-DD HH:mm') }}</div>
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
          <div class="action-card" v-for="action in actions" :key="action.key" @click="$router.push(action.path)">
            <div class="action-icon" :style="{ background: action.gradient }">
              <svg viewBox="0 0 24 24" class="action-svg" v-html="action.svgPath"></svg>
            </div>
            <div class="action-info">
              <div class="action-title">{{ action.title }}</div>
              <div class="action-desc">{{ action.desc }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <ImageDetail
      v-model:visible="previewVisible"
      :image="previewImage"
      :is-admin="userStore.isAdmin"
      :current-user-id="userStore.user?.id"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { statIcons, actionIcons } from '@/assets/icons'
import { RightOutlined, EyeOutlined } from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { favoriteApi } from '@/api/favorites'
import ImageDetail from '@/components/ImageDetail.vue'
import { useUserStore } from '@/stores/user'
import { formatDate } from '@/utils/date'

const userStore = useUserStore()

const loading = ref(false)

const stats = ref([
  {
    label: '图片总数',
    value: 0,
    svgPath: statIcons.images.svgPath,
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: statIcons.images.color
  },
  {
    label: '分类数量',
    value: 0,
    svgPath: statIcons.categories.svgPath,
    gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    color: statIcons.categories.color
  },
  {
    label: '标签数量',
    value: 0,
    svgPath: statIcons.tags.svgPath,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    color: statIcons.tags.color
  },
  {
    label: '收藏数量',
    value: 0,
    svgPath: statIcons.favorites.svgPath,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
    color: statIcons.favorites.color
  }
])

const actions = [
  {
    key: 'upload',
    title: '上传图片',
    desc: '批量上传，AI自动分类',
    path: '/upload',
    svgPath: actionIcons.upload.svgPath,
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
  },
  {
    key: 'browse',
    title: '浏览图片',
    desc: '按分类浏览全部图片',
    path: '/images',
    svgPath: actionIcons.browse.svgPath,
    gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
  },
  {
    key: 'category',
    title: '管理分类',
    desc: '添加或编辑分类',
    path: '/categories',
    svgPath: actionIcons.category.svgPath,
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
  },
  {
    key: 'tag',
    title: '管理标签',
    desc: '自定义图片标签',
    path: '/tags',
    svgPath: actionIcons.tag.svgPath,
    gradient: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
  }
]

const recentImages = ref([])
const previewVisible = ref(false)
const previewImage = ref(null)

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [imagesRes, categoriesRes, tagsRes] = await Promise.all([
      imageApi.getList({ page: 1, pageSize: 8 }),
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
    const favRes = await favoriteApi.getCount()
    stats.value[3].value = favRes.data?.count || 0
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

function getImageUrl(image, large = false) {
  if (!large && image.thumbnail_url) {
    return image.thumbnail_url
  }
  return image.file_url
}

function showPreview(image) {
  previewImage.value = image
  previewVisible.value = true
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
  position: relative;
  overflow: hidden;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.stat-decoration {
  position: absolute;
  right: -20px;
  top: -20px;
  width: 120px;
  height: 120px;
  pointer-events: none;
}

.decoration-svg {
  width: 100%;
  height: 100%;
}

.stat-icon {
  width: 60px;
  height: 60px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.stat-svg {
  width: 28px;
  height: 28px;
}

.stat-info {
  flex: 1;
  position: relative;
  z-index: 1;
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
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.image-card {
  border-radius: 10px;
  overflow: hidden;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.image-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
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
  font-size: 20px;
}

.image-card:hover .image-overlay {
  opacity: 1;
}

.image-info {
  padding: 10px;
}

.image-name {
  font-size: 12px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-date {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
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
  color: white;
}

.action-svg {
  width: 22px;
  height: 22px;
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

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .main-content {
    grid-template-columns: 1fr;
  }
}
</style>