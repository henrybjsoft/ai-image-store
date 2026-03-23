import request from './request'

export const logApi = {
  getList(params) {
    return request.get('/logs', { params })
  }
}