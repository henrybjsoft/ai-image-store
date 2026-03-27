import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 主题配置
export const themes = {
  purple: {
    name: '典雅紫',
    primary: '#6366f1',
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    sidebar: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    sidebarActive: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
  },
  blue: {
    name: '科技蓝',
    primary: '#0ea5e9',
    primaryLight: '#38bdf8',
    primaryDark: '#0284c7',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
    sidebar: 'linear-gradient(180deg, #0c4a6e 0%, #075985 50%, #0369a1 100%)',
    sidebarActive: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)'
  },
  green: {
    name: '清新绿',
    primary: '#10b981',
    primaryLight: '#34d399',
    primaryDark: '#059669',
    gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
    sidebar: 'linear-gradient(180deg, #064e3b 0%, #065f46 50%, #047857 100%)',
    sidebarActive: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
  },
  orange: {
    name: '活力橙',
    primary: '#f97316',
    primaryLight: '#fb923c',
    primaryDark: '#ea580c',
    gradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    sidebar: 'linear-gradient(180deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)',
    sidebarActive: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentTheme = ref(localStorage.getItem('theme') || 'purple')

  // 监听主题变化，更新CSS变量
  watch(currentTheme, (newTheme) => {
    applyTheme(newTheme)
    localStorage.setItem('theme', newTheme)
  }, { immediate: true })

  function applyTheme(themeName) {
    const theme = themes[themeName]
    if (!theme) return

    const root = document.documentElement
    root.style.setProperty('--primary-color', theme.primary)
    root.style.setProperty('--primary-light', theme.primaryLight)
    root.style.setProperty('--primary-dark', theme.primaryDark)
    root.style.setProperty('--primary-gradient', theme.gradient)
    root.style.setProperty('--sidebar-bg', theme.sidebar)
    root.style.setProperty('--sidebar-active', theme.sidebarActive)
  }

  function setTheme(themeName) {
    if (themes[themeName]) {
      currentTheme.value = themeName
    }
  }

  function getTheme() {
    return themes[currentTheme.value]
  }

  return {
    currentTheme,
    setTheme,
    getTheme,
    themes
  }
})