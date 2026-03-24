import request from './request'

export const systemApi = {
  getConfig() {
    return request.get('/system/config')
  },

  getStats() {
    return request.get('/system/stats')
  },

  getUserRanking(limit = 10) {
    return request.get('/system/user-ranking', { params: { limit } })
  }
}