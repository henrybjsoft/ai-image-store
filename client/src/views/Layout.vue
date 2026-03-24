<template>
  <a-layout class="layout-container" :class="{ 'sidebar-collapsed': collapsed }">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      :width="260"
      :collapsed-width="80"
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
              <div class="menu-icon-wrapper" :style="{ background: selectedKeys[0] === item.key ? 'rgba(255,255,255,0.2)' : `${item.color}15` }">
                <svg viewBox="0 0 24 24" class="menu-svg" :style="{ color: selectedKeys[0] === item.key ? '#fff' : item.color }" v-html="item.svgPath"></svg>
              </div>
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
              <div class="menu-icon-wrapper" :style="{ background: selectedKeys[0] === item.key ? 'rgba(255,255,255,0.2)' : `${item.color}15` }">
                <svg viewBox="0 0 24 24" class="menu-svg" :style="{ color: selectedKeys[0] === item.key ? '#fff' : item.color }" v-html="item.svgPath"></svg>
              </div>
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
        </div>

        <div class="header-right">
          <!-- 搜索栏 -->
          <div class="search-wrapper">
            <a-input
              v-model:value="searchKeyword"
              placeholder="搜索图片..."
              @pressEnter="handleSearch"
              class="search-input"
            >
              <template #prefix>
                <SearchOutlined class="search-icon" @click="handleSearch" />
              </template>
            </a-input>
          </div>

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
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { menuIcons } from '@/assets/icons'
import {
  PictureOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SearchOutlined,
  UserOutlined,
  DownOutlined,
  UploadOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const collapsed = ref(false)
const selectedKeys = ref(['dashboard'])
const searchKeyword = ref('')

const mainMenuItems = [
  { key: 'dashboard', name: '仪表盘', path: '/', ...menuIcons.dashboard },
  { key: 'images', name: '图片库', path: '/images', ...menuIcons.images },
  { key: 'semanticSearch', name: '语义搜索', path: '/semantic-search', ...menuIcons.semanticSearch },
  { key: 'upload', name: '上传图片', path: '/upload', ...menuIcons.upload },
  { key: 'favorites', name: '我的收藏', path: '/favorites', ...menuIcons.favorites }
]

const manageMenuItems = [
  { key: 'categories', name: '分类管理', path: '/categories', ...menuIcons.categories },
  { key: 'tags', name: '标签管理', path: '/tags', ...menuIcons.tags },
  { key: 'trash', name: '回收站', path: '/trash', ...menuIcons.trash },
  { key: 'logs', name: '操作日志', path: '/logs', ...menuIcons.logs },
  { key: 'users', name: '用户管理', path: '/users', ...menuIcons.users }
]

// 监听路由变化
watch(
  () => route.name,
  (name) => {
    const keyMap = {
      Dashboard: 'dashboard',
      Images: 'images',
      SemanticSearch: 'semanticSearch',
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
  position: fixed !important;
  left: 0;
  top: 0;
  bottom: 0;
  height: 100vh !important;
  background: linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%) !important;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 200;
}

.sidebar::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
}

.sidebar :deep(.ant-layout-sider-children) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.menu-wrapper {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 12px;
}

.menu-wrapper::-webkit-scrollbar {
  width: 4px;
}

.menu-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.logo-wrapper {
  padding: 24px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
}

.logo-wrapper::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-icon {
  width: 42px;
  height: 42px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.logo-text {
  color: white;
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  letter-spacing: 0.5px;
}

.menu-section {
  margin-bottom: 20px;
}

.menu-title {
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 10px;
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
  padding: 10px 12px;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: white;
}

.menu-item.active {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
}

.menu-icon-wrapper {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.menu-svg {
  width: 20px;
  height: 20px;
}

.menu-icon {
  font-size: 20px;
}

.menu-text {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

/* 折叠状态下只显示图标 */
.sidebar-collapsed .menu-item {
  justify-content: center;
  padding: 10px 0;
}

.sidebar-collapsed .menu-icon-wrapper {
  margin: 0;
}

/* 头部样式 */
.layout-header {
  background: white;
  padding: 0 24px !important;
  height: 72px !important;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
  margin-left: 260px;
  transition: margin-left 0.2s ease;
}

.sidebar-collapsed .layout-header {
  margin-left: 80px;
}

.header-left {
  display: flex;
  align-items: center;
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
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: #f1f5f9;
  color: #6366f1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-wrapper {
  width: 280px;
  display: flex;
  align-items: center;
}

.search-input {
  background: #f1f5f9;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.search-input:hover {
  background: #e8ecf2;
}

.search-input:focus,
.search-input :deep(.ant-input:focus) {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
}

.search-input :deep(.ant-input) {
  background: transparent;
  height: 36px !important;
  line-height: 36px !important;
  padding-left: 8px;
}

.search-icon {
  color: #94a3b8;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
}

.search-icon:hover {
  color: #6366f1;
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
  margin-left: 260px;
  transition: margin-left 0.2s ease;
}

.sidebar-collapsed .layout-content {
  margin-left: 80px;
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