<template>
  <div class="upload-page">
    <a-card title="上传图片">
      <a-upload-dragger
        v-model:fileList="fileList"
        :multiple="true"
        :before-upload="beforeUpload"
        :custom-request="customRequest"
        :accept="acceptTypes"
        :max-count="maxFiles"
        list-type="picture"
      >
        <p class="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p class="ant-upload-hint">
          支持 JPG、PNG、WebP、GIF、SVG 格式，单张不超过 10MB，单次最多 20 张
        </p>
      </a-upload-dragger>

      <!-- 上传进度 -->
      <div v-if="uploading" class="upload-progress">
        <a-progress :percent="uploadProgress" status="active" />
        <p>正在上传并处理图片，请稍候...</p>
      </div>

      <!-- 上传结果 -->
      <div v-if="uploadResults.length > 0" class="upload-results">
        <h4>上传结果</h4>
        <a-table :columns="resultColumns" :data-source="uploadResults" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="record.success ? 'success' : 'error'">
                {{ record.success ? '成功' : '失败' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'error'">
              <span v-if="record.error" style="color: #f5222d">{{ record.error }}</span>
            </template>
          </template>
        </a-table>
      </div>

      <div class="upload-actions">
        <a-button type="primary" :loading="uploading" :disabled="fileList.length === 0" @click="handleUpload">
          <UploadOutlined /> 开始上传
        </a-button>
        <a-button @click="handleClear" :disabled="fileList.length === 0">
          清空列表
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { InboxOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { imageApi } from '@/api/image'

const fileList = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadResults = ref([])

const acceptTypes = '.jpg,.jpeg,.png,.webp,.gif,.svg'
const maxFiles = 20
const maxFileSize = 10 * 1024 * 1024 // 10MB

const resultColumns = [
  { title: '文件名', dataIndex: 'original_name', key: 'name' },
  { title: '状态', key: 'status', width: 80 },
  { title: '错误信息', key: 'error' }
]

function beforeUpload(file) {
  // 检查文件类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  const isAllowed = allowedTypes.includes(file.type)
  if (!isAllowed) {
    message.error(`${file.name} 格式不支持`)
    return false
  }

  // 检查文件大小
  if (file.size > maxFileSize) {
    message.error(`${file.name} 超过 10MB 限制`)
    return false
  }

  // 检查数量
  if (fileList.value.length >= maxFiles) {
    message.warning(`最多上传 ${maxFiles} 张图片`)
    return false
  }

  return false // 阻止自动上传
}

function customRequest(options) {
  // 手动控制上传
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
  max-width: 800px;
  margin: 0 auto;
}

.upload-progress {
  margin-top: 24px;
  text-align: center;
}

.upload-results {
  margin-top: 24px;
}

.upload-results h4 {
  margin-bottom: 12px;
}

.upload-actions {
  margin-top: 24px;
  display: flex;
  gap: 12px;
}
</style>