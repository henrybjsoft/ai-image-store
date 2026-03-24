<template>
  <div class="upload-page">
    <div class="upload-container">
      <div class="upload-header">
        <h2>上传图片</h2>
        <p>支持 JPG、PNG、WebP、GIF、SVG 格式，单张不超过 10MB，单次最多 20 张</p>
      </div>

      <div class="upload-area">
        <a-upload-dragger
          v-model:fileList="fileList"
          :multiple="true"
          :before-upload="beforeUpload"
          :accept="acceptTypes"
          :max-count="maxFiles"
          list-type="picture-card"
          class="uploader"
        >
          <div class="upload-content">
            <div class="upload-icon">
              <CloudUploadOutlined />
            </div>
            <div class="upload-text">
              <p class="main-text">拖拽文件到这里，或<span class="link">点击上传</span></p>
              <p class="sub-text">支持批量上传，AI 将自动识别并分类</p>
            </div>
          </div>
        </a-upload-dragger>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploading" class="progress-section">
        <div class="progress-header">
          <span>正在处理...</span>
          <span>{{ uploadProgress }}%</span>
        </div>
        <a-progress :percent="uploadProgress" :show-info="false" stroke-color="#6366f1" />
      </div>

      <!-- 上传结果 -->
      <div v-if="uploadResults.length > 0" class="results-section">
        <h4>上传结果</h4>
        <div class="results-list">
          <div
            v-for="(result, index) in uploadResults"
            :key="index"
            class="result-item"
            :class="result.success ? 'success' : 'error'"
          >
            <div class="result-icon">
              <CheckCircleFilled v-if="result.success" />
              <CloseCircleFilled v-else />
            </div>
            <div class="result-name">{{ result.original_name }}</div>
            <div class="result-status">
              {{ result.success ? '成功' : result.error }}
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="upload-actions">
        <a-button type="primary" size="large" :loading="uploading" :disabled="fileList.length === 0" @click="handleUpload">
          <UploadOutlined /> 开始上传
        </a-button>
        <a-button size="large" :disabled="fileList.length === 0" @click="handleClear">
          清空列表
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { CloudUploadOutlined, UploadOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'

const fileList = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResults = ref([])

const acceptTypes = '.jpg,.jpeg,.png,.webp,.gif,.svg'
const maxFiles = 20
const maxFileSize = 10 * 1024 * 1024

function beforeUpload(file) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  const isAllowed = allowedTypes.includes(file.type)
  if (!isAllowed) {
    message.error(`${file.name} 格式不支持`)
    return false
  }

  if (file.size > maxFileSize) {
    message.error(`${file.name} 超过 10MB 限制`)
    return false
  }

  if (fileList.value.length >= maxFiles) {
    message.warning(`最多上传 ${maxFiles} 张图片`)
    return false
  }

  return false
}

async function handleUpload() {
  if (fileList.value.length === 0) {
    message.warning('请选择要上传的图片')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadResults.value = []

  const formData = new FormData()
  fileList.value.forEach(file => {
    formData.append('images', file.originFileObj || file)
  })

  try {
    const res = await imageApi.upload(formData, (progressEvent) => {
      uploadProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 100)
    })

    uploadResults.value = res.data || []
    const successCount = uploadResults.value.filter(r => r.success).length
    const failCount = uploadResults.value.filter(r => !r.success).length

    if (successCount > 0) {
      message.success(`成功上传 ${successCount} 张图片`)
    }
    if (failCount > 0) {
      message.warning(`${failCount} 张图片上传失败`)
    }

    fileList.value = []
  } catch (error) {
    message.error('上传失败')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

function handleClear() {
  fileList.value = []
  uploadResults.value = []
}
</script>

<style scoped>
.upload-page {
  max-width: 900px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease;
}

.upload-container {
  background: white;
  border-radius: 24px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.upload-header {
  text-align: center;
  margin-bottom: 32px;
}

.upload-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.upload-header p {
  color: #64748b;
  font-size: 14px;
}

.upload-area {
  margin-bottom: 24px;
}

.uploader {
  border-radius: 16px !important;
  border: 2px dashed #e2e8f0 !important;
  background: #f8fafc !important;
  transition: all 0.3s ease !important;
}

.uploader:hover {
  border-color: #6366f1 !important;
  background: #f0f4ff !important;
}

.upload-content {
  padding: 48px 24px;
  text-align: center;
}

.upload-icon {
  font-size: 48px;
  color: #6366f1;
  margin-bottom: 16px;
}

.upload-text .main-text {
  font-size: 16px;
  color: #1e293b;
  margin-bottom: 8px;
}

.upload-text .link {
  color: #6366f1;
  font-weight: 500;
}

.upload-text .sub-text {
  font-size: 13px;
  color: #94a3b8;
}

.progress-section {
  margin-bottom: 24px;
  padding: 20px;
  background: #f8fafc;
  border-radius: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #64748b;
}

.results-section {
  margin-bottom: 24px;
}

.results-section h4 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1e293b;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 14px;
}

.result-item.success {
  background: #f0fdf4;
  color: #10b981;
}

.result-item.error {
  background: #fef2f2;
  color: #ef4444;
}

.result-icon {
  font-size: 18px;
}

.result-name {
  flex: 1;
  color: #1e293b;
}

.result-status {
  font-size: 13px;
}

.upload-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.upload-actions .ant-btn {
  min-width: 140px;
  height: 48px;
  font-weight: 500;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>