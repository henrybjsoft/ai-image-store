import request from './request'

export const favoriteApi = {
  getList(params) {
    return request.get('/favorites', { params })
  },

  getCount() {
    return request.get('/favorites/count')
  }
}