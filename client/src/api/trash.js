import request from './request'

export const trashApi = {
  getList(params) {
    return request.get('/trash', { params })
  },

  restore(ids) {
    return request.post('/trash/restore', { ids })
  },

  permanentDelete(id) {
    return request.delete(`/trash/${id}`)
  },

  empty() {
    return request.delete('/trash')
  }
}