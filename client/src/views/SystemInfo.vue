<template>
  <div class="system-info-page">
    <div class="page-header">
      <h2>系统信息</h2>
      <p>查看系统配置和统计数据</p>
    </div>

    <!-- 操作区域 -->
    <div class="action-section">
      <a-button type="primary" :loading="rebuilding" @click="confirmRebuild">
        <template #icon><SyncOutlined /></template>
        重建所有向量
      </a-button>
      <span class="action-hint">重新生成所有图片的向量数据</span>
    </div>

    <!-- 统计概览 -->
    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-icon images">
          <PictureOutlined />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.imageCount }}</div>
          <div class="stat-label">图片总数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon storage">
          <DatabaseOutlined />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatBytes(stats.totalBytes) }}</div>
          <div class="stat-label">存储空间</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon vectors">
          <BranchesOutlined />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.vectorCount }}</div>
          <div class="stat-label">向量数量</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon users">
          <TeamOutlined />
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.userCount }}</div>
          <div class="stat-label">用户数量</div>
        </div>
      </div>
    </div>

    <!-- 配置信息 -->
    <div class="config-section">
      <h3>系统配置</h3>
      <div class="config-grid">
        <!-- 服务器配置 -->
        <div class="config-card">
          <div class="config-header">
            <CloudServerOutlined />
            <span>服务器配置</span>
          </div>
          <div class="config-body">
            <div class="config-item">
              <span class="config-label">端口</span>
              <span class="config-value">{{ config.server?.port }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">环境</span>
              <span class="config-value">{{ config.server?.nodeEnv }}</span>
            </div>
          </div>
        </div>

        <!-- JWT配置 -->
        <div class="config-card">
          <div class="config-header">
            <LockOutlined />
            <span>JWT 配置</span>
          </div>
          <div class="config-body">
            <div class="config-item">
              <span class="config-label">过期时间</span>
              <span class="config-value">{{ config.jwt?.expiresIn }}</span>
            </div>
          </div>
        </div>

        <!-- 上传配置 -->
        <div class="config-card">
          <div class="config-header">
            <UploadOutlined />
            <span>上传配置</span>
          </div>
          <div class="config-body">
            <div class="config-item">
              <span class="config-label">最大文件大小</span>
              <span class="config-value">{{ formatBytes(config.upload?.maxFileSize) }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">最大文件数</span>
              <span class="config-value">{{ config.upload?.maxFiles }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">并发数</span>
              <span class="config-value">{{ config.upload?.uploadConcurrency }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">允许格式</span>
              <span class="config-value">{{ config.upload?.allowedFormats }}</span>
            </div>
          </div>
        </div>

        <!-- 缩略图配置 -->
        <div class="config-card">
          <div class="config-header">
            <PictureOutlined />
            <span>缩略图配置</span>
          </div>
          <div class="config-body">
            <div class="config-item">
              <span class="config-label">尺寸</span>
              <span class="config-value">{{ config.thumbnail?.size }}px</span>
            </div>
            <div class="config-item">
              <span class="config-label">质量</span>
              <span class="config-value">{{ config.thumbnail?.quality }}%</span>
            </div>
          </div>
        </div>

        <!-- AI 配置 -->
        <div class="config-card">
          <div class="config-header">
            <RobotOutlined />
            <span>AI 配置</span>
          </div>
          <div class="config-body">
            <div class="config-item">
              <span class="config-label">视觉模型</span>
              <span class="config-value">{{ config.ai?.visionModel }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">Embedding 模型</span>
              <span class="config-value">{{ config.ai?.embeddingModel }}</span>
            </div>
            <div class="config-item">
              <span class="config-label">API Key</span>
              <span class="config-value masked">{{ config.ai?.apiKey || '未配置' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 用户排名 -->
    <div class="ranking-section">
      <h3>用户图片排名</h3>
      <a-table
        :columns="columns"
        :data-source="ranking"
        :loading="loading"
        :pagination="false"
        size="middle"
        row-key="id"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'rank'">
            <span class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
          </template>
          <template v-else-if="column.key === 'name'">
            {{ record.name || record.username }}
          </template>
          <template v-else-if="column.key === 'role'">
            <a-tag :color="record.role === 'admin' ? 'red' : 'blue'">
              {{ record.role === 'admin' ? '管理员' : '普通用户' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'image_count'">
            <span class="count-value">{{ record.image_count }}</span>
          </template>
          <template v-else-if="column.key === 'total_bytes'">
            {{ formatBytes(record.total_bytes) }}
          </template>
        </template>
      </a-table>
    </div>

    <!-- 重建向量进度弹窗 -->
    <a-modal
      v-model:open="rebuildModalVisible"
      title="重建向量进度"
      :closable="!rebuilding"
      :maskClosable="false"
      :footer="null"
      width="500px"
      centered
    >
      <div class="rebuild-progress">
        <a-progress
          :percent="rebuildProgress.progress"
          :status="rebuildStatus"
        />
        <div class="progress-info">
          <span>{{ rebuildProgress.message }}</span>
          <span v-if="rebuildProgress.total > 0">
            {{ rebuildProgress.current }} / {{ rebuildProgress.total }}
          </span>
        </div>
        <div class="progress-actions" v-if="rebuilding">
          <a-button danger @click="stopRebuild">
            停止
          </a-button>
        </div>
        <div class="progress-result" v-else-if="rebuildResult">
          <p>成功: {{ rebuildResult.success }}</p>
          <p>失败: {{ rebuildResult.failed }}</p>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  PictureOutlined,
  DatabaseOutlined,
  BranchesOutlined,
  TeamOutlined,
  CloudServerOutlined,
  LockOutlined,
  UploadOutlined,
  RobotOutlined,
  SyncOutlined
} from '@ant-design/icons-vue'
import { systemApi } from '@/api/system'

const loading = ref(false)
const config = ref({})
const stats = ref({
  imageCount: 0,
  totalBytes: 0,
  vectorCount: 0,
  userCount: 0,
  categoryCount: 0,
  tagCount: 0
})
const ranking = ref([])

// 重建向量相关
const rebuilding = ref(false)
const rebuildModalVisible = ref(false)
const rebuildProgress = ref({
  progress: 0,
  current: 0,
  total: 0,
  message: ''
})
const rebuildResult = ref(null)
let eventSource = null

const rebuildStatus = computed(() => {
  if (rebuildProgress.value.progress >= 100) return 'success'
  return 'active'
})

const columns = [
  { title: '排名', key: 'rank', width: 60 },
  { title: '用户名', key: 'name' },
  { title: '角色', key: 'role', width: 100 },
  { title: '图片数量', key: 'image_count', width: 120 },
  { title: '占用空间', key: 'total_bytes', width: 120 }
]

onMounted(async () => {
  await loadData()
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close()
  }
})

async function loadData() {
  loading.value = true
  try {
    const [configRes, statsRes, rankingRes] = await Promise.all([
      systemApi.getConfig(),
      systemApi.getStats(),
      systemApi.getUserRanking(20)
    ])
    config.value = configRes.data || {}
    stats.value = statsRes.data || {}
    ranking.value = rankingRes.data || []
  } catch (error) {
    message.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

function confirmRebuild() {
  Modal.confirm({
    title: '确认重建向量',
    content: '将为系统中所有图片重新生成向量数据，此操作可能需要较长时间。确定要继续吗？',
    okText: '确定',
    cancelText: '取消',
    onOk() {
      startRebuild()
    }
  })
}

async function startRebuild() {
  rebuilding.value = true
  rebuildModalVisible.value = true
  rebuildProgress.value = { progress: 0, current: 0, total: 0, message: '初始化...' }
  rebuildResult.value = null

  // 获取 token
  const token = localStorage.getItem('token')

  // 创建 EventSource
  const url = `${import.meta.env.VITE_API_URL || ''}/api/system/rebuild-all-vectors`
  eventSource = new EventSource(`${url}?token=${token}`, { withCredentials: true })

  // 由于 EventSource 不支持自定义 header，使用 fetch + ReadableStream
  eventSource.close()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'text/event-stream'
      }
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value)
      const lines = text.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            handleRebuildEvent(data)
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
  } catch (error) {
    message.error('重建向量失败: ' + error.message)
    rebuilding.value = false
  }
}

function handleRebuildEvent(data) {
  switch (data.type) {
    case 'start':
      rebuildProgress.value.message = data.message
      break
    case 'info':
      rebuildProgress.value.message = data.message
      break
    case 'progress':
      rebuildProgress.value.progress = data.progress
      rebuildProgress.value.current = data.current
      rebuildProgress.value.total = data.total
      rebuildProgress.value.message = `处理中 ${data.current}/${data.total}`
      break
    case 'done':
      rebuildProgress.value.progress = 100
      rebuildProgress.value.message = data.message
      rebuildResult.value = { success: data.success, failed: data.failed }
      rebuilding.value = false
      // 刷新统计数据
      loadData()
      break
    case 'stopped':
      rebuildProgress.value.message = data.message
      rebuilding.value = false
      break
    case 'error':
      message.error(data.message || data.error)
      rebuilding.value = false
      break
  }
}

async function stopRebuild() {
  try {
    await systemApi.stopRebuild()
    message.info('已发送停止信号')
  } catch (error) {
    message.error('停止失败')
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let size = Number(bytes)
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return size.toFixed(i > 0 ? 2 : 0) + ' ' + units[i]
}
</script>

<style scoped>
.system-info-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.page-header p {
  color: #64748b;
  font-size: 14px;
}

/* 统计概览 */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-icon.images {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
}

.stat-icon.storage {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
  color: white;
}

.stat-icon.vectors {
  background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
  color: white;
}

.stat-icon.users {
  background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
  color: white;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

/* 配置区域 */
.config-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  margin-bottom: 24px;
}

.config-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.config-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--primary-color, #6366f1) 0%, var(--secondary-color, #8b5cf6) 100%);
  color: white;
  font-weight: 500;
}

.config-body {
  padding: 12px 16px;
}

.config-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.config-item:last-child {
  border-bottom: none;
}

.config-label {
  color: #64748b;
  font-size: 13px;
}

.config-value {
  color: #1e293b;
  font-weight: 500;
  font-size: 13px;
}

.config-value.masked {
  font-family: monospace;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

/* 操作区域 */
.action-section {
  background: white;
  border-radius: 16px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 16px;
}

.action-hint {
  color: #64748b;
  font-size: 13px;
}

/* 重建进度 */
.rebuild-progress {
  padding: 16px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  color: #64748b;
  font-size: 13px;
}

.progress-actions {
  margin-top: 20px;
  text-align: center;
}

.progress-result {
  margin-top: 16px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 8px;
}

.progress-result p {
  margin: 4px 0;
  font-size: 13px;
  color: #1e293b;
}

/* 排名区域 */
.ranking-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.ranking-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 20px;
}

.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 600;
  font-size: 13px;
}

.rank-badge.rank-1 {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
}

.rank-badge.rank-2 {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  color: white;
}

.rank-badge.rank-3 {
  background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
  color: white;
}

.count-value {
  font-weight: 600;
  color: var(--primary-color, #6366f1);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1200px) {
  .stats-overview {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .stats-overview {
    grid-template-columns: 1fr;
  }
}
</style>