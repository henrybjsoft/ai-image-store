import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'images',
        name: 'Images',
        component: () => import('@/views/Images.vue')
      },
      {
        path: 'semantic-search',
        name: 'SemanticSearch',
        component: () => import('@/views/SemanticSearch.vue')
      },
      {
        path: 'upload',
        name: 'Upload',
        component: () => import('@/views/Upload.vue')
      },
      {
        path: 'favorites',
        name: 'Favorites',
        component: () => import('@/views/Favorites.vue')
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('@/views/Categories.vue')
      },
      {
        path: 'tags',
        name: 'Tags',
        component: () => import('@/views/Tags.vue')
      },
      {
        path: 'trash',
        name: 'Trash',
        component: () => import('@/views/Trash.vue')
      },
      {
        path: 'logs',
        name: 'Logs',
        component: () => import('@/views/Logs.vue')
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users.vue')
      },
      {
        path: 'change-password',
        name: 'ChangePassword',
        component: () => import('@/views/ChangePassword.vue')
      },
      {
        path: 'system-info',
        name: 'SystemInfo',
        component: () => import('@/views/SystemInfo.vue')
      }
    ]
  }
]

// 从环境变量获取基础路径，用于路由，示例：/bj-images
const baseUrl = import.meta.env.VITE_BASE_URL || ''
// createWebHistory 需要末尾有 /
const routerBase = baseUrl ? `${baseUrl}/` : '/'

const router = createRouter({
  history: createWebHistory(routerBase),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  if (to.meta.requiresAuth !== false && !userStore.isLoggedIn) {
    next('/login')
  } else if (to.path === '/login' && userStore.isLoggedIn) {
    next('/')
  } else {
    next()
  }
})

export default router