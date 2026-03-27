import request from './request'

export const searchApi = {
  keyword(params) {
    return request.get('/search/keyword', { params })
  },

  semantic(data) {
    return request.post('/search/semantic', data)
  },

  byTag(params) {
    return request.get('/search/by-tag', { params })
  }
}