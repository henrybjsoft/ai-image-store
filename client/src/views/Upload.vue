<template>
  <div class="upload-page">
    <div class="upload-container">
      <div class="upload-header">
        <h2>上传图片</h2>
        <p>支持 JPG、PNG、WebP、GIF、SVG 格式，单张不超过 10MB，单次最多 100 张</p>
        <p v-if="userStore.user?.role !== 'admin' && quotaInfo.quota > 0" class="quota-info">
          已上传 {{ quotaInfo.imageCount }} / {{ quotaInfo.quota }} 张（剩余 {{ quotaInfo.quota - quotaInfo.imageCount }} 张）
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

      <div class="upload-area">
        <a-upload-dragger
          :file-list="displayFileList"
          :multiple="true"
          :before-upload="beforeUpload"
          :accept="acceptTypes"
          :remove="handleRemoveValidFile"
          list-type="picture-card"
          class="uploader"
          @change="handleFileChange"
          @preview="handlePreview"
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

      <!-- 文件列表（显示无效文件） -->
      <div v-if="invalidFiles.length > 0" class="invalid-section">
        <div class="invalid-header">
          <ExclamationCircleOutlined />
          <span>以下文件不符合要求，将被跳过</span>
        </div>
        <div class="invalid-list">
          <div v-for="file in invalidFiles" :key="file.uid" class="invalid-item">
            <CloseCircleOutlined class="invalid-icon" />
            <span class="invalid-name">{{ file.name }}</span>
            <span class="invalid-reason">{{ file.invalidReason }}</span>
            <a-button type="link" size="small" @click="removeInvalidFile(file.uid)">移除</a-button>
          </div>
        </div>
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
  SettingOutlined
} from '@ant-design/icons-vue'
import { getToken } from '@/utils/auth'
import { categoryApi } from '@/api/category'
import { tagApi } from '@/api/tag'
import { userApi } from '@/api/user'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

// 所有文件列表（包含有效和无效）
const allFiles = ref([])
const uploading = ref(false)
const uploadingItems = ref([])
const showResult = ref(false)

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

// 显示在上传组件中的文件列表（只显示有效文件）
const displayFileList = computed(() => {
  return validFiles.value
})

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
  if (userStore.user?.role !== 'admin') {
    try {
      const res = await userApi.getQuotaInfo()
      quotaInfo.value = res.data
    } catch (error) {
      console.error('加载配额信息失败:', error)
    }
  }
}

// 处理文件变化
function handleFileChange(info) {
  // 更新所有文件列表
  allFiles.value = info.fileList.map(file => {
    // 保留已有的 invalidReason
    if (!file.invalidReason) {
      file.invalidReason = null
    }
    return file
  })

  // 检查每个文件的有效性
  checkFileValidity()
}

// 检查文件有效性
let hasShownLimitWarning = false

function checkFileValidity() {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']

  // 先检查格式和大小
  allFiles.value.forEach(file => {
    const isAllowed = allowedTypes.includes(file.type)

    if (!isAllowed) {
      file.invalidReason = '格式不支持'
    } else if (file.size > maxFileSize) {
      file.invalidReason = `超过10MB限制 (${(file.size / 1024 / 1024).toFixed(1)}MB)`
    } else if (!file.invalidReason || file.invalidReason.startsWith('超出数量限制')) {
      // 格式和大小都有效，清除之前的数量限制标记（后面会重新计算）
      file.invalidReason = null
    }
  })

  // 再检查数量限制
  let validCount = 0
  allFiles.value.forEach(file => {
    // 跳过已经因为格式/大小被标记为无效的
    if (file.invalidReason && !file.invalidReason.startsWith('超出数量限制')) {
      return
    }

    validCount++
    if (validCount > maxFiles) {
      file.invalidReason = `超出数量限制（最多${maxFiles}张）`
    }
  })

  // 显示警告
  const currentValidCount = allFiles.value.filter(f => !f.invalidReason).length
  if (currentValidCount > maxFiles && !hasShownLimitWarning) {
    message.warning(`最多上传 ${maxFiles} 张图片，已自动跳过超出部分`)
    hasShownLimitWarning = true
  }
}

function beforeUpload() {
  // 返回 false 阻止自动上传，我们手动控制
  return false
}

function handleRemoveValidFile(file) {
  const index = allFiles.value.findIndex(f => f.uid === file.uid)
  if (index > -1) {
    allFiles.value.splice(index, 1)
  }
  // 重新检查数量限制，可能之前超出的现在变成有效的了
  checkFileValidity()
  return true
}

function removeInvalidFile(uid) {
  const index = allFiles.value.findIndex(f => f.uid === uid)
  if (index > -1) {
    allFiles.value.splice(index, 1)
  }
}

async function handleUpload() {
  const filesToUpload = validFiles.value

  if (filesToUpload.length === 0) {
    message.warning('没有可上传的有效图片')
    return
  }

  uploading.value = true
  showResult.value = false

  // 初始化进度列表
  uploadingItems.value = filesToUpload.map(file => ({
    fileName: file.name,
    status: 'pending',
    stepText: '等待处理...',
    progress: 0
  }))

  const formData = new FormData()
  filesToUpload.forEach(file => {
    formData.append('images', file.originFileObj || file)
  })

  // 添加可选的分类和标签
  if (selectedCategory.value) {
    formData.append('categoryId', selectedCategory.value)
  }
  if (selectedTags.value && selectedTags.value.length > 0) {
    formData.append('tagIds', JSON.stringify(selectedTags.value))
  }

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
    // 只清除有效文件，保留无效文件让用户看到
    allFiles.value = allFiles.value.filter(f => f.invalidReason)
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
      hasShownLimitWarning = false
      if (data.success > 0) {
        message.success(`成功上传 ${data.success} 张图片`)
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
  // 使用本地文件预览
  if (file.originFileObj) {
    previewImage.value = URL.createObjectURL(file.originFileObj)
    previewTitle.value = file.name
    previewVisible.value = true
  }
}

function handlePreviewClose() {
  previewVisible.value = false
  previewTitle.value = ''
  // 释放 blob URL
  if (previewImage.value && previewImage.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewImage.value)
  }
  previewImage.value = ''
}

function handleClear() {
  allFiles.value = []
  uploadingItems.value = []
  showResult.value = false
  hasShownLimitWarning = false
  handlePreviewClose()
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

/* 无效文件列表 */
.invalid-section {
  margin-bottom: 24px;
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
}

.invalid-name {
  color: #1e293b;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invalid-reason {
  color: #ef4444;
  font-size: 12px;
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