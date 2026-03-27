/**
 * 认证相关工具函数
 */

export function getToken() {
  return localStorage.getItem('token') || ''
}

export function setToken(token) {
  localStorage.setItem('token', token)
}

export function removeToken() {
  localStorage.removeItem('token')
}