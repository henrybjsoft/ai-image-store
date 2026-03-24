<template>
  <a-layout class="layout-container">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      :width="260"
      class="sidebar"
    >
      <!-- Logo -->
      <div class="logo-wrapper">
        <div class="logo">
          <div class="logo-icon">
            <PictureOutlined />
          </div>
          <transition name="fade">
            <span v-show="!collapsed" class="logo-text">素材管理</span>
          </transition>
        </div>
      </div>

      <!-- 菜单 -->
      <div class="menu-wrapper">
        <div class="menu-section">
          <div v-show="!collapsed" class="menu-title">主菜单</div>
          <div class="menu-items">
            <div
              v-for="item in mainMenuItems"
              :key="item.key"
              class="menu-item"
              :class="{ active: selectedKeys[0] === item.key }"
              @click="$router.push(item.path)"
            >
              <component :is="item.icon" class="menu-icon" />
              <transition name="fade">
                <span v-show="!collapsed" class="menu-text">{{ item.name }}</span>
              </transition>
            </div>
          </div>
        </div>

        <div class="menu-section">
          <div v-show="!collapsed" class="menu-title">管理</div>
          <div class="menu-items">
            <div
              v-for="item in manageMenuItems"
              :key="item.key"
              class="menu-item"
              :class="{ active: selectedKeys[0] === item.key }"
              @click="$router.push(item.path)"
            >
              <component :is="item.icon" class="menu-icon" />
              <transition name="fade">
                <span v-show="!collapsed" class="menu-text">{{ item.name }}</span>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </a-layout-sider>

    <a-layout class="main-layout">
      <!-- 顶部导航 -->
      <a-layout-header class="layout-header">
        <div class="header-left">
          <div class="collapse-btn" @click="collapsed = !collapsed">
            <MenuUnfoldOutlined v-if="collapsed" />
            <MenuFoldOutlined v-else />
          </div>

          <!-- 搜索栏 -->
          <div class="search-wrapper">
            <a-input-search
              v-model:value="searchKeyword"
              placeholder="搜索图片..."
              enter-button
              @search="handleSearch"
              class="search-input"
            >
              <template #prefix>
                <SearchOutlined />
              </template>
            </a-input-search>
          </div>
        </div>

        <div class="header-right">
          <!-- 快捷操作 -->
          <a-button type="primary" class="upload-btn" @click="$router.push('/upload')">
            <UploadOutlined /> 上传
          </a-button>

          <!-- 用户信息 -->
          <a-dropdown>
            <div class="user-info">
              <a-avatar class="user-avatar">
                {{ userStore.user?.username?.charAt(0).toUpperCase() }}
              </a-avatar>
              <span class="username">{{ userStore.user?.username }}</span>
              <DownOutlined class="dropdown-icon" />
            </div>
            <template #overlay>
              <a-menu class="user-menu">
                <a-menu-item key="profile">
                  <UserOutlined /> 个人信息
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" @click="handleLogout">
                  <LogoutOutlined /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 主内容区 -->
      <a-layout-content class="layout-content">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
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
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
  DownOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const collapsed = ref(false)
const selectedKeys = ref(['dashboard'])
const searchKeyword = ref('')

const mainMenuItems = [
  { key: 'dashboard', name: '仪表盘', icon: 'HomeOutlined', path: '/' },
  { key: 'images', name: '图片库', icon: 'PictureOutlined', path: '/images' },
  { key: 'upload', name: '上传图片', icon: 'UploadOutlined', path: '/upload' },
  { key: 'favorites', name: '我的收藏', icon: 'HeartOutlined', path: '/favorites' },
]

const manageMenuItems = [
  { key: 'categories', name: '分类管理', icon: 'FolderOutlined', path: '/categories' },
  { key: 'tags', name: '标签管理', icon: 'TagsOutlined', path: '/tags' },
  { key: 'trash', name: '回收站', icon: 'DeleteOutlined', path: '/trash' },
  { key: 'logs', name: '操作日志', icon: 'FileTextOutlined', path: '/logs' },
  { key: 'users', name: '用户管理', icon: 'TeamOutlined', path: '/users' },
]

// 监听路由变化
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
  background: #f1f5f9;
}

/* 侧边栏样式 */
.sidebar {
  background: linear-gradient(180deg, #1e1b4b 0%, #312e81 100%) !important;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.12);
}

.logo-wrapper {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
}

.logo-text {
  color: white;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
}

.menu-wrapper {
  padding: 16px 12px;
}

.menu-section {
  margin-bottom: 24px;
}

.menu-title {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
  padding: 0 12px;
}

.menu-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  color: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.menu-item.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.menu-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.menu-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

/* 头部样式 */
.layout-header {
  background: white;
  padding: 0 24px;
  height: 72px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.collapse-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background: #f1f5f9;
  color: #6366f1;
}

.search-wrapper {
  width: 320px;
}

.search-input {
  border-radius: 10px;
}

.search-input :deep(.ant-input) {
  border-radius: 10px 0 0 10px;
}

.search-input :deep(.ant-input-search-button) {
  border-radius: 0 10px 10px 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 20px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border: none;
  font-weight: 500;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.user-info:hover {
  background: #f1f5f9;
}

.user-avatar {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.dropdown-icon {
  font-size: 10px;
  color: #94a3b8;
}

/* 内容区样式 */
.layout-content {
  padding: 24px;
  min-height: calc(100vh - 72px);
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.3s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>