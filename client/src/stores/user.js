import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function login(username, password) {
    const res = await authApi.login(username, password)
    if (res.success) {
      token.value = res.data.token
      user.value = res.data.user
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    }
    return res
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch (e) {
      console.error('Logout error:', e)
    }
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  async function fetchCurrentUser() {
    const res = await authApi.me()
    if (res.success) {
      user.value = res.data
      localStorage.setItem('user', JSON.stringify(res.data))
    }
    return res
  }

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    login,
    logout,
    fetchCurrentUser
  }
})