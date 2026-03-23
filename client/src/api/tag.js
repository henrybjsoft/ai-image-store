import request from './request'

export const tagApi = {
  getList() {
    return request.get('/tags')
  },

  create(data) {
    return request.post('/tags', data)
  },

  update(id, data) {
    return request.put(`/tags/${id}`, data)
  },

  delete(id) {
    return request.delete(`/tags/${id}`)
  }
}