<template>
  <div class="logs-page">
    <a-page-header title="操作日志" />

    <div class="filter-bar">
      <a-space>
        <a-select v-model:value="filters.action" placeholder="操作类型" allow-clear style="width: 150px" @change="loadLogs">
          <a-select-option value="login">登录</a-select-option>
          <a-select-option value="logout">登出</a-select-option>
          <a-select-option value="upload_image">上传图片</a-select-option>
          <a-select-option value="delete_image">删除图片</a-select-option>
          <a-select-option value="restore_images">恢复图片</a-select-option>
          <a-select-option value="create_category">创建分类</a-select-option>
          <a-select-option value="delete_category">删除分类</a-select-option>
          <a-select-option value="create_user">创建用户</a-select-option>
          <a-select-option value="delete_user">删除用户</a-select-option>
        </a-select>
        <a-range-picker v-model:value="filters.dateRange" @change="loadLogs" />
      </a-space>
    </div>

    <a-table
      :columns="columns"
      :data-source="logs"
      :loading="loading"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-tag :color="getActionColor(record.action)">{{ getActionText(record.action) }}</a-tag>
        </template>
        <template v-if="column.key === 'createdAt'">
          {{ formatDate(record.created_at) }}
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import dayjs from 'dayjs'
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
  total: 0,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 条`
})

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '操作人', dataIndex: 'username', width: 120 },
  { title: '操作类型', key: 'action', width: 120 },
  { title: '操作详情', dataIndex: 'details' },
  { title: 'IP地址', dataIndex: 'ip_address', width: 140 },
  { title: '操作时间', key: 'createdAt', width: 180 }
]

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

function handleTableChange(pag) {
  pagination.current = pag.current
  pagination.pageSize = pag.pageSize
  loadLogs()
}

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function getActionText(action) {
  const map = {
    login: '登录',
    logout: '登出',
    upload_image: '上传图片',
    delete_image: '删除图片',
    restore_images: '恢复图片',
    create_category: '创建分类',
    update_category: '更新分类',
    delete_category: '删除分类',
    create_tag: '创建标签',
    delete_tag: '删除标签',
    create_user: '创建用户',
    update_user: '更新用户',
    delete_user: '删除用户',
    change_password: '修改密码',
    favorite_image: '收藏图片',
    unfavorite_image: '取消收藏'
  }
  return map[action] || action
}

function getActionColor(action) {
  const map = {
    login: 'green',
    logout: 'default',
    upload_image: 'blue',
    delete_image: 'red',
    restore_images: 'orange',
    create_category: 'cyan',
    delete_category: 'red',
    create_user: 'purple',
    delete_user: 'red'
  }
  return map[action] || 'default'
}
</script>

<style scoped>
.filter-bar {
  margin-bottom: 16px;
}
</style>