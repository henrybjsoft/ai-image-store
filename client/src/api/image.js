import request from './request'

export const imageApi = {
  upload(formData, onProgress) {
    return request.post('/images/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: onProgress
    })
  },

  getList(params) {
    return request.get('/images', { params })
  },

  getDetail(id) {
    return request.get(`/images/${id}`)
  },

  update(id, data) {
    return request.put(`/images/${id}`, data)
  },

  delete(id) {
    return request.delete(`/images/${id}`)
  },

  batchDelete(ids) {
    return request.post('/images/batch-delete', { ids })
  },

  download(id) {
    // 使用带认证的请求下载
    return request.get(`/images/download/${id}`, {
      responseType: 'blob'
    })
  },

  batchDownload(ids) {
    return request.post('/images/batch-download', { ids }, {
      responseType: 'blob'
    })
  },

  toggleFavorite(id) {
    return request.put(`/images/${id}/favorite`)
  },

  changeCategory(id, categoryId) {
    return request.put(`/images/${id}/category`, { categoryId })
  },

  addTag(id, tagId) {
    return request.post(`/images/${id}/tags`, { tagId })
  },

  removeTag(id, tagId) {
    return request.delete(`/images/${id}/tags/${tagId}`)
  },

  reanalyze(id) {
    return request.post(`/images/${id}/reanalyze`)
  },

  generatePrompt(id) {
    return request.post(`/images/${id}/generate-prompt`)
  }
}