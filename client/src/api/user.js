import request from './request'

export const userApi = {
  getList() {
    return request.get('/users')
  },

  create(data) {
    return request.post('/users', data)
  },

  update(id, data) {
    return request.put(`/users/${id}`, data)
  },

  changePassword(id, password) {
    return request.put(`/users/${id}/password`, { password })
  },

  changeOwnPassword(data) {
    return request.put('/users/me/password', data)
  },

  delete(id) {
    return request.delete(`/users/${id}`)
  }
}