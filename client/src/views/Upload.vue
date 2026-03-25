<template>
  <div class="upload-page">
    <div class="upload-container">
      <div class="upload-header">
        <h2>上传图片</h2>
        <p>支持 JPG、PNG、WebP、GIF、SVG 格式，单张不超过 10MB，单次最多 100 张</p>
        <p v-if="quotaInfo.imageCount !== undefined" class="quota-info">
          <template v-if="userStore.isAdmin">
            已上传 {{ quotaInfo.imageCount }} 张
          </template>
          <template v-else-if="quotaInfo.quota > 0">
            已上传 {{ quotaInfo.imageCount }} / {{ quotaInfo.quota }} 张（剩余 {{ quotaInfo.quota - quotaInfo.imageCount }} 张）
          </template>
        </p>
      </div>

      <!-- 可选设置 -->
      <div class="optional-settings">
        <div class="settings-title">
          <SettingOutlined /> 可选设置（不填则自动识别）
        </div>
        <div class="settings-row">
          <div class="setting-item">
            <label>分类</label>
            <a-tree-select
              v-model:value="selectedCategory"
              :tree-data="categoryTree"
              placeholder="自动识别"
              allow-clear
              class="setting-select"
            />
          </div>
          <div class="setting-item">
            <label>标签</label>
            <a-select
              v-model:value="selectedTags"
              mode="multiple"
              placeholder="自动识别"
              allow-clear
              class="setting-select"
            >
              <a-select-option v-for="tag in tags" :key="tag.id" :value="tag.id">
                {{ tag.name }}
              </a-select-option>
            </a-select>
          </div>
        </div>
      </div>

      <!-- 上传区域 -->
      <div class="upload-area">
        <div
          class="upload-dropzone"
          :class="{ 'dragover': isDragover }"
          @click="triggerFileSelect"
          @dragover.prevent="handleDragover"
          @dragleave.prevent="handleDragleave"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            multiple
            :accept="acceptTypes"
            style="display: none"
            @change="handleFileInputChange"
          />
          <div class="upload-content">
            <div class="upload-icon">
              <CloudUploadOutlined />
            </div>
            <div class="upload-text">
              <p class="main-text">拖拽文件到这里，或<span class="link">点击上传</span></p>
              <p class="sub-text">支持批量上传，AI 将自动识别并分类</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件列表 -->
      <div v-if="allFiles.length > 0" class="file-list-section">
        <!-- 有效文件列表 -->
        <div v-if="validFiles.length > 0" class="valid-files">
          <div class="list-header">
            <span>待上传文件 ({{ validFiles.length }} 张)</span>
            <span class="total-size">共 {{ formatTotalSize(validFiles) }}</span>
          </div>
          <div class="file-grid">
            <div
              v-for="file in validFiles"
              :key="file.uid"
              class="file-card"
              :class="file.uploadStatus"
            >
              <div class="card-thumbnail" @click="handlePreview(file)">
                <img v-if="file.thumbUrl" :src="file.thumbUrl" :alt="file.name" />
                <div v-else class="placeholder-icon">
                  <FileImageOutlined />
                </div>
                <div class="preview-overlay">
                  <EyeOutlined />
                </div>
              </div>
              <div class="card-info">
                <div class="card-name" :title="file.name">{{ file.name }}</div>
                <div class="card-meta">
                  <span class="card-size">{{ formatSize(file.size) }}</span>
                </div>
                <!-- 进度条 -->
                <div v-if="file.uploadStatus === 'uploading'" class="card-progress">
                  <a-progress
                    :percent="file.uploadProgress"
                    :show-info="false"
                    :stroke-color="progressColors"
                    size="small"
                  />
                  <div class="progress-text">
                    <LoadingOutlined class="spinning" />
                    {{ file.uploadStepText }}
                  </div>
                </div>
                <div v-else-if="file.uploadStatus === 'success'" class="card-status success">
                  <CheckCircleFilled /> 上传成功
                </div>
                <div v-else-if="file.uploadStatus === 'error'" class="card-status error">
                  <CloseCircleFilled /> {{ file.uploadError || '上传失败' }}
                </div>
              </div>
              <div class="card-actions">
                <a-button
                  v-if="!uploading"
                  type="text"
                  size="small"
                  danger
                  @click="removeFile(file.uid)"
                >
                  <DeleteOutlined />
                </a-button>
              </div>
            </div>
          </div>
        </div>

        <!-- 无效文件列表 -->
        <div v-if="invalidFiles.length > 0" class="invalid-section">
          <div class="invalid-header">
            <ExclamationCircleOutlined />
            <span>以下文件不符合要求，将被跳过</span>
          </div>
          <div class="invalid-list">
            <div v-for="file in invalidFiles" :key="file.uid" class="invalid-item">
              <CloseCircleOutlined class="invalid-icon" />
              <span class="invalid-name">{{ file.name }}</span>
              <span class="invalid-size">{{ formatSize(file.size) }}</span>
              <span class="invalid-reason">{{ file.invalidReason }}</span>
              <a-button type="link" size="small" @click="removeFile(file.uid)">移除</a-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 上传结果统计 -->
      <div v-if="showResult" class="result-summary">
        <a-alert
          :type="uploadResult.failed > 0 ? 'warning' : 'success'"
          show-icon
        >
          <template #message>
            <span v-if="uploadResult.success > 0">成功上传 {{ uploadResult.success }} 张图片</span>
            <span v-if="uploadResult.failed > 0">，{{ uploadResult.failed }} 张失败</span>
          </template>
        </a-alert>
      </div>

      <!-- 操作按钮 -->
      <div class="upload-actions">
        <a-button
          type="primary"
          size="large"
          :loading="uploading"
          :disabled="validFiles.length === 0"
          @click="handleUpload"
        >
          <UploadOutlined /> 开始上传 ({{ validFiles.length }} 张)
        </a-button>
        <a-button size="large" :disabled="allFiles.length === 0 || uploading" @click="handleClear">
          清空列表
        </a-button>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <a-modal
      :open="previewVisible"
      :title="previewTitle"
      :footer="null"
      @cancel="handlePreviewClose"
    >
      <img :src="previewImage" style="width: 100%" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloudUploadOutlined,
  UploadOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  ExclamationCircleOutlined,
  SettingOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileImageOutlined
} from '@ant-design/icons-vue'
import { getToken } from '@/utils/auth'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { userApi } from '@/api/user'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 文件列表
const allFiles = ref([])
const uploading = ref(false)
const showResult = ref(false)

// 上传结果统计
const uploadResult = ref({ success: 0, failed: 0 })

// 文件输入引用
const fileInputRef = ref(null)

// 拖拽状态
const isDragover = ref(false)

// 配额信息
const quotaInfo = ref({ quota: 0, imageCount: 0, role: 'user' })

// 可选设置
const categories = ref([])
const tags = ref([])
const selectedCategory = ref(null)
const selectedTags = ref([])

const acceptTypes = '.jpg,.jpeg,.png,.webp,.gif,.svg'
const maxFiles = 100
const maxFileSize = 10 * 1024 * 1024

const progressColors = {
  '0%': '#6366f1',
  '100%': '#8b5cf6'
}

// 分类树结构
const categoryTree = computed(() => {
  const buildTree = (items, parentId = null) => {
    return items
      .filter(item => item.parent_id === parentId)
      .map(item => ({
        value: item.id,
        title: item.name,
        children: buildTree(items, item.id)
      }))
  }
  return buildTree(categories.value)
})

// 无效文件列表
const invalidFiles = computed(() => {
  return allFiles.value.filter(file => file.invalidReason)
})

// 有效文件列表
const validFiles = computed(() => {
  return allFiles.value.filter(file => !file.invalidReason)
})

onMounted(async () => {
  await loadOptions()
  await loadQuotaInfo()
})

async function loadOptions() {
  try {
    const [catRes, tagRes] = await Promise.all([
      categoryApi.getTree(),
      tagApi.getList()
    ])
    categories.value = catRes.data || []
    tags.value = tagRes.data || []
  } catch (error) {
    console.error('加载选项失败:', error)
  }
}

async function loadQuotaInfo() {
  try {
    const res = await userApi.getQuotaInfo()
    quotaInfo.value = res.data
  } catch (error) {
    console.error('加载配额信息失败:', error)
  }
}

// 格式化文件大小
function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// 格式化总大小
function formatTotalSize(files) {
  const total = files.reduce((sum, f) => sum + (f.size || 0), 0)
  return formatSize(total)
}

// 触发文件选择
function triggerFileSelect() {
  fileInputRef.value?.click()
}

// 处理文件输入变化
function handleFileInputChange(e) {
  const files = Array.from(e.target.files || [])
  processFiles(files)
  // 清空 input 以便可以再次选择相同文件
  e.target.value = ''
}

// 处理拖拽进入
function handleDragover() {
  isDragover.value = true
}

// 处理拖拽离开
function handleDragleave() {
  isDragover.value = false
}

// 处理拖放
function handleDrop(e) {
  isDragover.value = false
  const files = Array.from(e.dataTransfer.files || [])
  processFiles(files)
}

// 处理文件
let hasShownLimitWarning = false
let hasShownQuotaWarning = false

function processFiles(files) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

  files.forEach(file => {
    const uid = Date.now() + '_' + Math.random().toString(36).slice(2, 11)

    // 检查格式和大小
    let invalidReason = null
    if (!allowedTypes.includes(file.type)) {
      invalidReason = '格式不支持'
    } else if (file.size > maxFileSize) {
      invalidReason = `超过10MB限制 (${(file.size / 1024 / 1024).toFixed(1)}MB)`
    }

    const fileItem = {
      uid,
      name: file.name,
      size: file.size,
      type: file.type,
      originFileObj: file,
      thumbUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      invalidReason,
      uploadStatus: 'pending', // pending, uploading, success, error
      uploadProgress: 0,
      uploadStepText: '',
      uploadError: ''
    }

    allFiles.value.push(fileItem)
  })

  // 重新检查数量限制
  checkFileValidity()
}

// 检查文件有效性
function checkFileValidity() {
  const remainingQuota = !userStore.isAdmin && quotaInfo.value.quota > 0
    ? quotaInfo.value.quota - quotaInfo.value.imageCount
    : null

  let validCount = 0
  const validFilesList = allFiles.value.filter(f => !f.invalidReason || f.invalidReason.startsWith('超出数量限制') || f.invalidReason.startsWith('超出配额限制'))

  validFilesList.forEach(file => {
    // 跳过已经因为格式/大小被标记为无效的
    if (file.invalidReason && !file.invalidReason.startsWith('超出数量限制') && !file.invalidReason.startsWith('超出配额限制')) {
      return
    }

    validCount++

    // 检查单次上传数量限制（100张）
    if (validCount > maxFiles) {
      file.invalidReason = `超出数量限制（最多${maxFiles}张）`
      return
    }

    // 检查配额限制（普通用户）
    if (remainingQuota !== null && validCount > remainingQuota) {
      file.invalidReason = `超出配额限制（剩余${remainingQuota}张）`
    } else {
      file.invalidReason = null
    }
  })

  // 显示警告
  const currentValidCount = allFiles.value.filter(f => !f.invalidReason).length
  if (currentValidCount > maxFiles && !hasShownLimitWarning) {
    message.warning(`最多上传 ${maxFiles} 张图片，已自动跳过超出部分`)
    hasShownLimitWarning = true
  }

  if (remainingQuota !== null && currentValidCount > remainingQuota && !hasShownQuotaWarning) {
    message.warning(`剩余配额 ${remainingQuota} 张，已自动跳过超出部分`)
    hasShownQuotaWarning = true
  }
}

// 移除文件
function removeFile(uid) {
  const index = allFiles.value.findIndex(f => f.uid === uid)
  if (index > -1) {
    const file = allFiles.value[index]
    // 释放 blob URL
    if (file.thumbUrl && file.thumbUrl.startsWith('blob:')) {
      URL.revokeObjectURL(file.thumbUrl)
    }
    allFiles.value.splice(index, 1)
  }
  // 重新检查数量限制
  checkFileValidity()
}

// 上传
async function handleUpload() {
  const filesToUpload = validFiles.value.filter(f => f.uploadStatus !== 'success')

  if (filesToUpload.length === 0) {
    message.warning('没有可上传的有效图片')
    return
  }

  uploading.value = true
  showResult.value = false
  uploadResult.value = { success: 0, failed: 0 }

  // 初始化上传状态
  filesToUpload.forEach(file => {
    file.uploadStatus = 'uploading'
    file.uploadProgress = 0
    file.uploadStepText = '等待处理...'
  })

  const formData = new FormData()
  filesToUpload.forEach(file => {
    formData.append('images', file.originFileObj)
  })

  // 添加可选的分类和标签
  if (selectedCategory.value) {
    formData.append('categoryId', selectedCategory.value)
  }
  if (selectedTags.value && selectedTags.value.length > 0) {
    formData.append('tagIds', JSON.stringify(selectedTags.value))
  }

  try {
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
            handleProgressEvent(data, filesToUpload)
          } catch (e) {
            console.error('解析进度数据失败:', e)
          }
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6))
        handleProgressEvent(data, filesToUpload)
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
    // 释放并清除成功的文件
    allFiles.value.forEach(file => {
      if (file.uploadStatus === 'success' && file.thumbUrl && file.thumbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(file.thumbUrl)
      }
    })
    allFiles.value = allFiles.value.filter(f => f.uploadStatus !== 'success')
  }
}

function handleProgressEvent(data, filesToUpload) {
  switch (data.type) {
    case 'progress':
      const file = filesToUpload[data.fileIndex]
      if (file) {
        file.uploadStatus = 'uploading'
        file.uploadProgress = data.progress
        file.uploadStepText = data.stepText
      }
      break

    case 'complete':
      const completeFile = filesToUpload[data.fileIndex]
      if (completeFile) {
        completeFile.uploadStatus = 'success'
        completeFile.uploadProgress = 100
      }
      break

    case 'error':
      const errorFile = filesToUpload[data.fileIndex]
      if (errorFile) {
        errorFile.uploadStatus = 'error'
        errorFile.uploadError = data.error
      }
      break

    case 'done':
      hasShownLimitWarning = false
      hasShownQuotaWarning = false
      // 保存上传结果
      uploadResult.value = {
        success: data.success || 0,
        failed: data.failed || 0
      }
      if (data.success > 0) {
        message.success(`成功上传 ${data.success} 张图片`)
        loadQuotaInfo()
      }
      if (data.failed > 0) {
        message.warning(`${data.failed} 张图片上传失败`)
      }
      break
  }
}

// 预览本地文件
const previewVisible = ref(false)
const previewImage = ref('')
const previewTitle = ref('')

function handlePreview(file) {
  if (file.thumbUrl) {
    previewImage.value = file.thumbUrl
    previewTitle.value = file.name
    previewVisible.value = true
  } else if (file.originFileObj) {
    previewImage.value = URL.createObjectURL(file.originFileObj)
    previewTitle.value = file.name
    previewVisible.value = true
  }
}

function handlePreviewClose() {
  previewVisible.value = false
  previewTitle.value = ''
  if (previewImage.value && previewImage.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewImage.value)
  }
  previewImage.value = ''
}

function handleClear() {
  // 释放所有 blob URL
  allFiles.value.forEach(file => {
    if (file.thumbUrl && file.thumbUrl.startsWith('blob:')) {
      URL.revokeObjectURL(file.thumbUrl)
    }
  })
  allFiles.value = []
  showResult.value = false
  uploadResult.value = { success: 0, failed: 0 }
  hasShownLimitWarning = false
  hasShownQuotaWarning = false
  handlePreviewClose()
}
</script>

<style scoped>
.upload-page {
  max-width: 1000px;
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

.quota-info {
  margin-top: 8px;
  color: #6366f1;
  font-weight: 500;
}

/* 可选设置 */
.optional-settings {
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.settings-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  margin-bottom: 16px;
}

.settings-row {
  display: flex;
  gap: 24px;
}

.setting-item {
  flex: 1;
}

.setting-item label {
  display: block;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.setting-select {
  width: 100%;
}

/* 上传区域 */
.upload-area {
  margin-bottom: 24px;
}

.upload-dropzone {
  border: 2px dashed #e2e8f0;
  border-radius: 16px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.upload-dropzone:hover,
.upload-dropzone.dragover {
  border-color: #6366f1;
  background: #f0f4ff;
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

/* 文件列表区域 */
.file-list-section {
  margin-bottom: 24px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
}

.total-size {
  color: #64748b;
  font-weight: 400;
}

/* 文件网格 */
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.file-card {
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  position: relative;
}

.file-card:hover {
  background: #f1f5f9;
}

.file-card.uploading {
  background: #f0f4ff;
  border: 1px solid #c7d2fe;
}

.file-card.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.file-card.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.card-thumbnail {
  aspect-ratio: 1;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.card-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  font-size: 32px;
  color: #94a3b8;
}

.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
  font-size: 20px;
}

.card-thumbnail:hover .preview-overlay {
  opacity: 1;
}

.card-info {
  padding: 12px;
}

.card-name {
  font-size: 13px;
  font-weight: 500;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-size {
  font-size: 12px;
  color: #94a3b8;
}

.card-progress {
  margin-top: 8px;
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6366f1;
  margin-top: 4px;
}

.card-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin-top: 4px;
}

.card-status.success {
  color: #10b981;
}

.card-status.error {
  color: #ef4444;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.file-card:hover .card-actions {
  opacity: 1;
}

/* 无效文件列表 */
.invalid-section {
  margin-top: 24px;
  padding: 16px 20px;
  background: #fef2f2;
  border-radius: 12px;
  border: 1px solid #fecaca;
}

.invalid-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
  color: #dc2626;
}

.invalid-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.invalid-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
}

.invalid-icon {
  color: #ef4444;
  font-size: 14px;
  flex-shrink: 0;
}

.invalid-name {
  color: #1e293b;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invalid-size {
  color: #94a3b8;
  font-size: 12px;
  flex-shrink: 0;
}

.invalid-reason {
  color: #ef4444;
  font-size: 12px;
  flex-shrink: 0;
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