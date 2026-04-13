import axios from 'axios'
import { message, Modal } from 'ant-design-vue'
import router from '@/router'

// 从环境变量获取基础路径，默认为空，示例：/bj-images
const baseUrl = import.meta.env.VITE_BASE_URL || ''
// API 基础路径
const apiBaseURL = baseUrl ? `${baseUrl}/api` : '/api'

const request = axios.create({
  baseURL: apiBaseURL,
  timeout: 60000
})

// 防止重复弹窗
let isTokenExpiredModalShown = false

// 请求拦截器
request.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    return response.data
  },
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          if (!isTokenExpiredModalShown) {
            isTokenExpiredModalShown = true
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            Modal.confirm({
              title: '登录凭据已过期',
              content: '您的登录状态已失效，请重新登录',
              okText: '重新登录',
              cancelText: '取消',
              onOk: () => {
                router.push('/login')
                isTokenExpiredModalShown = false
              },
              onCancel: () => {
                isTokenExpiredModalShown = false
              }
            })
          }
          break
        case 403:
          message.error('没有权限执行此操作')
          break
        case 404:
          message.error('请求的资源不存在')
          break
        case 500:
          message.error('服务器错误，请稍后重试')
          break
        default:
          message.error(error.response.data?.message || '请求失败')
      }
    } else {
      message.error('网络错误，请检查网络连接')
    }
    return Promise.reject(error)
  }
)

export default request