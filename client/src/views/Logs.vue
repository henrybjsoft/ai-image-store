<template>
  <div class="logs-page">
    <div class="page-header">
      <div class="header-content">
        <h2>操作日志</h2>
        <p>查看系统操作记录</p>
      </div>
    </div>

    <div class="filter-bar">
      <a-select v-model:value="filters.action" placeholder="操作类型" allow-clear style="width: 160px" @change="loadLogs">
        <a-select-option value="login">登录</a-select-option>
        <a-select-option value="logout">登出</a-select-option>
        <a-select-option value="upload_image">上传图片</a-select-option>
        <a-select-option value="delete_image">删除图片</a-select-option>
        <a-select-option value="create_category">创建分类</a-select-option>
        <a-select-option value="create_user">创建用户</a-select-option>
      </a-select>
      <a-range-picker v-model:value="filters.dateRange" @change="loadLogs" />
    </div>

    <div class="logs-list">
      <div v-for="log in logs" :key="log.id" class="log-item">
        <div class="log-icon" :class="getActionClass(log.action)">
          <component :is="getActionIcon(log.action)" />
        </div>
        <div class="log-content">
          <div class="log-title">
            <span class="log-user">{{ log.username }}</span>
            <span class="log-action">{{ getActionText(log.action) }}</span>
          </div>
          <div class="log-detail">{{ log.details }}</div>
        </div>
        <div class="log-meta">
          <div class="log-time">{{ formatDate(log.created_at) }}</div>
          <div class="log-ip">{{ log.ip_address }}</div>
        </div>
      </div>
    </div>

    <div class="pagination-wrapper" v-if="pagination.total > 0">
      <a-pagination
        v-model:current="pagination.current"
        :total="pagination.total"
        :show-total="total => `共 ${total} 条`"
        @change="loadLogs"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import dayjs from 'dayjs'
import { LoginOutlined, LogoutOutlined, UploadOutlined, DeleteOutlined, FolderAddOutlined, UserAddOutlined } from '@ant-design/icons-vue'
import { logApi } from '@/api/log'

const loading = ref(false)
const logs = ref([])

const filters = reactive({
  action: null,
  dateRange: null
})

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0
})

onMounted(() => {
  loadLogs()
})

async function loadLogs() {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      pageSize: pagination.pageSize,
      action: filters.action,
      startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
      endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD')
    }

    const res = await logApi.getList(params)
    logs.value = res.data?.list || []
    pagination.total = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function formatDate(date) {
  return dayjs(date).format('MM-DD HH:mm:ss')
}

function getActionText(action) {
  const map = {
    login: '登录系统',
    logout: '退出系统',
    upload_image: '上传图片',
    delete_image: '删除图片',
    restore_images: '恢复图片',
    create_category: '创建分类',
    create_user: '创建用户'
  }
  return map[action] || action
}

function getActionIcon(action) {
  const map = {
    login: 'LoginOutlined',
    logout: 'LogoutOutlined',
    upload_image: 'UploadOutlined',
    delete_image: 'DeleteOutlined',
    create_category: 'FolderAddOutlined',
    create_user: 'UserAddOutlined'
  }
  return map[action] || 'LoginOutlined'
}

function getActionClass(action) {
  const map = {
    login: 'success',
    logout: 'default',
    upload_image: 'primary',
    delete_image: 'danger',
    create_category: 'warning',
    create_user: 'info'
  }
  return map[action] || 'default'
}
</script>

<style scoped>
.logs-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  margin-bottom: 24px;
}

.header-content h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 4px;
}

.header-content p {
  color: #64748b;
  font-size: 14px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: white;
  border-radius: 16px;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.log-item:hover {
  background: #f8fafc;
}

.log-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.log-icon.success { background: #dcfce7; color: #10b981; }
.log-icon.danger { background: #fee2e2; color: #ef4444; }
.log-icon.primary { background: #dbeafe; color: #3b82f6; }
.log-icon.warning { background: #fef3c7; color: #f59e0b; }
.log-icon.info { background: #e0e7ff; color: #6366f1; }
.log-icon.default { background: #f1f5f9; color: #64748b; }

.log-content {
  flex: 1;
}

.log-title {
  margin-bottom: 4px;
}

.log-user {
  font-weight: 600;
  color: #1e293b;
  margin-right: 8px;
}

.log-action {
  color: #64748b;
}

.log-detail {
  font-size: 13px;
  color: #94a3b8;
}

.log-meta {
  text-align: right;
}

.log-time {
  font-size: 13px;
  color: #1e293b;
  margin-bottom: 2px;
}

.log-ip {
  font-size: 12px;
  color: #94a3b8;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
  padding: 16px;
  background: white;
  border-radius: 16px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>