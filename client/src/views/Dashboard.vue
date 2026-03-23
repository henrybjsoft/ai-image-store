<template>
  <div class="dashboard">
    <a-row :gutter="24">
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic title="图片总数" :value="stats.totalImages">
            <template #prefix>
              <PictureOutlined style="color: #1890ff" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic title="分类数量" :value="stats.totalCategories">
            <template #prefix>
              <FolderOutlined style="color: #52c41a" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic title="标签数量" :value="stats.totalTags">
            <template #prefix>
              <TagsOutlined style="color: #faad14" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="6">
        <a-card class="stat-card">
          <a-statistic title="收藏数量" :value="stats.totalFavorites">
            <template #prefix>
              <HeartOutlined style="color: #f5222d" />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="24" style="margin-top: 24px">
      <a-col :span="12">
        <a-card title="最近上传">
          <a-list :data-source="recentImages" :loading="loading">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta :description="item.description">
                  <template #avatar>
                    <a-image
                      :src="getImageUrl(item)"
                      :width="60"
                      :height="60"
                      style="object-fit: cover"
                    />
                  </template>
                  <template #title>
                    <a @click="viewImage(item)">{{ item.original_name }}</a>
                  </template>
                </a-list-item-meta>
                <template #actions>
                  <span>{{ formatDate(item.created_at) }}</span>
                </template>
              </a-list-item>
            </template>
          </a-list>
        </a-card>
      </a-col>

      <a-col :span="12">
        <a-card title="快速操作">
          <a-space direction="vertical" style="width: 100%">
            <a-button type="primary" block @click="$router.push('/upload')">
              <UploadOutlined /> 上传图片
            </a-button>
            <a-button block @click="$router.push('/images')">
              <PictureOutlined /> 浏览图片
            </a-button>
            <a-button block @click="$router.push('/categories')">
              <FolderOutlined /> 管理分类
            </a-button>
            <a-button block @click="$router.push('/tags')">
              <TagsOutlined /> 管理标签
            </a-button>
          </a-space>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { PictureOutlined, FolderOutlined, TagsOutlined, HeartOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'

const router = useRouter()
const loading = ref(false)

const stats = ref({
  totalImages: 0,
  totalCategories: 0,
  totalTags: 0,
  totalFavorites: 0
})

const recentImages = ref([])

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    const [imagesRes, categoriesRes, tagsRes] = await Promise.all([
      imageApi.getList({ page: 1, pageSize: 5 }),
      categoryApi.getTree(),
      tagApi.getList()
    ])

    recentImages.value = imagesRes.data?.list || []
    stats.value.totalImages = imagesRes.data?.total || 0

    // 计算分类数量（包括子分类）
    let catCount = 0
    const countCategories = (cats) => {
      cats.forEach(cat => {
        catCount++
        if (cat.children?.length) {
          countCategories(cat.children)
        }
      })
    }
    countCategories(categoriesRes.data || [])
    stats.value.totalCategories = catCount

    stats.value.totalTags = tagsRes.data?.length || 0

    // 计算收藏数量
    const favRes = await imageApi.getList({ isFavorite: true, pageSize: 1 })
    stats.value.totalFavorites = favRes.data?.total || 0
  } catch (error) {
    console.error('加载数据失败:', error)
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

function viewImage(image) {
  router.push({
    path: '/images',
    query: { id: image.id }
  })
}
</script>

<style scoped>
.stat-card {
  text-align: center;
}
</style>