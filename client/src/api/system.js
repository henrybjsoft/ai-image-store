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
  },

  rebuildAllVectors() {
    return request.post('/system/rebuild-all-vectors', {}, {
      responseType: 'text'
    })
  },

  getRebuildProgress() {
    return request.get('/system/rebuild-progress')
  },

  stopRebuild() {
    return request.post('/system/stop-rebuild')
  }
}