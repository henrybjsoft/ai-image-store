<template>
  <a-layout class="layout-container">
    <a-layout-sider v-model:collapsed="collapsed" :trigger="null" collapsible>
      <div class="logo">
        <img src="/favicon.svg" alt="Logo" />
        <span v-show="!collapsed">素材管理</span>
      </div>

      <a-menu
        v-model:selectedKeys="selectedKeys"
        theme="dark"
        mode="inline"
      >
        <a-menu-item key="dashboard" @click="$router.push('/')">
          <HomeOutlined />
          <span>仪表盘</span>
        </a-menu-item>

        <a-menu-item key="images" @click="$router.push('/images')">
          <PictureOutlined />
          <span>图片管理</span>
        </a-menu-item>

        <a-menu-item key="upload" @click="$router.push('/upload')">
          <UploadOutlined />
          <span>上传图片</span>
        </a-menu-item>

        <a-menu-item key="favorites" @click="$router.push('/favorites')">
          <HeartOutlined />
          <span>我的收藏</span>
        </a-menu-item>

        <a-menu-item key="categories" @click="$router.push('/categories')">
          <FolderOutlined />
          <span>分类管理</span>
        </a-menu-item>

        <a-menu-item key="tags" @click="$router.push('/tags')">
          <TagsOutlined />
          <span>标签管理</span>
        </a-menu-item>

        <a-menu-item key="trash" @click="$router.push('/trash')">
          <DeleteOutlined />
          <span>回收站</span>
        </a-menu-item>

        <a-menu-item key="logs" @click="$router.push('/logs')">
          <FileTextOutlined />
          <span>操作日志</span>
        </a-menu-item>

        <a-menu-item key="users" @click="$router.push('/users')">
          <TeamOutlined />
          <span>用户管理</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header class="layout-header">
        <div class="header-left">
          <MenuUnfoldOutlined
            v-if="collapsed"
            class="trigger"
            @click="collapsed = !collapsed"
          />
          <MenuFoldOutlined
            v-else
            class="trigger"
            @click="collapsed = !collapsed"
          />

          <!-- 搜索栏 -->
          <div class="search-bar">
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索图片..."
              enter-button
              @search="handleSearch"
              style="width: 300px"
            />
          </div>
        </div>

        <div class="header-right">
          <a-dropdown>
            <div class="user-info">
              <a-avatar style="backgroundColor: #1890ff">
                {{ userStore.user?.username?.charAt(0).toUpperCase() }}
              </a-avatar>
              <span class="username">{{ userStore.user?.username }}</span>
            </div>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="handleLogout">
                  <LogoutOutlined />
                  退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <a-layout-content class="layout-content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  HomeOutlined,
  PictureOutlined,
  UploadOutlined,
  HeartOutlined,
  FolderOutlined,
  TagsOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const collapsed = ref(false)
const selectedKeys = ref(['dashboard'])
const searchKeyword = ref('')

// 监听路由变化更新选中菜单
watch(
  () => route.name,
  (name) => {
    const keyMap = {
      Dashboard: 'dashboard',
      Images: 'images',
      Upload: 'upload',
      Favorites: 'favorites',
      Categories: 'categories',
      Tags: 'tags',
      Trash: 'trash',
      Logs: 'logs',
      Users: 'users'
    }
    selectedKeys.value = [keyMap[name] || 'dashboard']
  },
  { immediate: true }
)

function handleSearch() {
  if (searchKeyword.value.trim()) {
    router.push({
      path: '/images',
      query: { keyword: searchKeyword.value.trim() }
    })
  }
}

function handleLogout() {
  userStore.logout()
}
</script>

<style scoped>
.layout-container {
  min-height: 100vh;
}

.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo img {
  width: 32px;
  height: 32px;
  margin-right: 8px;
}

.layout-header {
  background: white;
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 24px;
}

.trigger {
  font-size: 18px;
  cursor: pointer;
  transition: color 0.3s;
}

.trigger:hover {
  color: #1890ff;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: 14px;
  color: #333;
}

.layout-content {
  margin: 24px;
  padding: 24px;
  background: white;
  border-radius: 8px;
  min-height: calc(100vh - 112px);
}
</style>