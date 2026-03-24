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

      <!-- 上传进度列表 -->
      <div v-if="uploadingItems.length > 0" class="progress-section">
        <div class="progress-header">
          <span>处理进度</span>
          <span>{{ completedCount }} / {{ uploadingItems.length }}</span>
        </div>
        <div class="progress-list">
          <div
            v-for="item in uploadingItems"
            :key="item.fileName"
            class="progress-item"
            :class="item.status"
          >
            <div class="item-info">
              <div class="item-name">{{ item.fileName }}</div>
              <div class="item-step" v-if="item.status === 'processing'">
                <LoadingOutlined class="spinning" />
                {{ item.stepText }}
              </div>
              <div class="item-step success" v-else-if="item.status === 'success'">
                <CheckCircleFilled /> 上传成功
              </div>
              <div class="item-step error" v-else-if="item.status === 'error'">
                <CloseCircleFilled /> {{ item.error || '处理失败' }}
              </div>
            </div>
            <div class="item-progress" v-if="item.status === 'processing'">
              <a-progress
                :percent="item.progress"
                :show-info="false"
                :stroke-color="progressColors"
                size="small"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 上传结果统计 -->
      <div v-if="showResult" class="result-summary">
        <a-alert
          :type="failedCount > 0 ? 'warning' : 'success'"
          show-icon
        >
          <template #message>
            <span v-if="successCount > 0">成功上传 {{ successCount }} 张图片</span>
            <span v-if="failedCount > 0">，{{ failedCount }} 张失败</span>
          </template>
        </a-alert>
      </div>

      <!-- 操作按钮 -->
      <div class="upload-actions">
        <a-button
          type="primary"
          size="large"
          :loading="uploading"
          :disabled="fileList.length === 0"
          @click="handleUpload"
        >
          <UploadOutlined /> 开始上传
        </a-button>
        <a-button size="large" :disabled="fileList.length === 0 || uploading" @click="handleClear">
          清空列表
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloudUploadOutlined,
  UploadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined
} from '@ant-design/icons-vue'
import { getToken } from '@/utils/auth'

const fileList = ref([])
const uploading = ref(false)
const uploadingItems = ref([])
const showResult = ref(false)

const acceptTypes = '.jpg,.jpeg,.png,.webp,.gif,.svg'
const maxFiles = 20
const maxFileSize = 10 * 1024 * 1024

const progressColors = {
  '0%': '#6366f1',
  '100%': '#8b5cf6'
}

const completedCount = computed(() => {
  return uploadingItems.value.filter(item =>
    item.status === 'success' || item.status === 'error'
  ).length
})

const successCount = computed(() => {
  return uploadingItems.value.filter(item => item.status === 'success').length
})

const failedCount = computed(() => {
  return uploadingItems.value.filter(item => item.status === 'error').length
})

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
  showResult.value = false

  // 初始化进度列表
  uploadingItems.value = fileList.value.map(file => ({
    fileName: file.name,
    status: 'pending',
    stepText: '等待处理...',
    progress: 0
  }))

  const formData = new FormData()
  fileList.value.forEach(file => {
    formData.append('images', file.originFileObj || file)
  })

  try {
    // 使用 fetch 发送请求并接收 SSE
    const response = await fetch('/api/images/upload-progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error('上传请求失败')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            handleProgressEvent(data)
          } catch (e) {
            console.error('解析进度数据失败:', e)
          }
        }
      }
    }

    // 处理最后可能剩余的数据
    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6))
        handleProgressEvent(data)
      } catch (e) {
        // 忽略解析错误
      }
    }

  } catch (error) {
    console.error('上传失败:', error)
    message.error('上传失败: ' + error.message)
  } finally {
    uploading.value = false
    showResult.value = true
    fileList.value = []
  }
}

function handleProgressEvent(data) {
  switch (data.type) {
    case 'start':
      // 开始上传
      break

    case 'progress':
      // 更新进度
      const item = uploadingItems.value[data.fileIndex]
      if (item) {
        item.status = 'processing'
        item.step = data.step
        item.stepText = data.stepText
        item.progress = data.progress
      }
      break

    case 'complete':
      // 单个文件完成
      const completeItem = uploadingItems.value[data.fileIndex]
      if (completeItem) {
        completeItem.status = 'success'
        completeItem.progress = 100
        completeItem.imageId = data.result?.id
      }
      break

    case 'error':
      // 单个文件失败
      const errorItem = uploadingItems.value[data.fileIndex]
      if (errorItem) {
        errorItem.status = 'error'
        errorItem.error = data.error
      }
      break

    case 'done':
      // 全部完成
      if (data.success > 0) {
        message.success(`成功上传 ${data.success} 张图片`)
      }
      if (data.failed > 0) {
        message.warning(`${data.failed} 张图片上传失败`)
      }
      break
  }
}

function handleClear() {
  fileList.value = []
  uploadingItems.value = []
  showResult.value = false
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
  border-radius: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.progress-item.processing {
  border-left: 3px solid #6366f1;
}

.progress-item.success {
  border-left: 3px solid #10b981;
}

.progress-item.error {
  border-left: 3px solid #ef4444;
}

.item-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 16px;
}

.item-step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #64748b;
  flex-shrink: 0;
}

.item-step.success {
  color: #10b981;
}

.item-step.error {
  color: #ef4444;
}

.item-step .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.item-progress {
  margin-top: 4px;
}

.result-summary {
  margin-bottom: 24px;
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