import request from './request'

export const authApi = {
  login(username, password) {
    return request.post('/auth/login', { username, password })
  },

  logout() {
    return request.post('/auth/logout')
  },

  me() {
    return request.get('/auth/me')
  }
}