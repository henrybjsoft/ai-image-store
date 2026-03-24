<template>
  <div class="users-page">
    <div class="page-header">
      <div class="header-content">
        <h2>用户管理</h2>
        <p>管理系统用户账号和权限</p>
      </div>
      <a-button type="primary" @click="showAddModal">
        <PlusOutlined /> 添加用户
      </a-button>
    </div>

    <div class="users-table">
      <a-table :columns="columns" :data-source="users" :loading="loading" row-key="id">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'username'">
            <div class="user-cell">
              <div class="user-avatar-small">
                {{ (record.name || record.username).charAt(0).toUpperCase() }}
              </div>
              <div>
                <div class="user-name">{{ record.name || record.username }}</div>
                <div class="user-login-name">@{{ record.username }}</div>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'role'">
            <a-tag :color="record.role === 'admin' ? 'purple' : 'blue'">
              {{ record.role === 'admin' ? '管理员' : '普通用户' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status ? 'green' : 'red'">
              {{ record.status ? '可用' : '禁用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'validity'">
            <div class="validity-cell">
              <div v-if="record.valid_from || record.valid_until">
                <span v-if="record.valid_from">{{ record.valid_from }}</span>
                <span v-else>不限</span>
                ~
                <span v-if="record.valid_until">{{ record.valid_until }}</span>
                <span v-else>不限</span>
              </div>
              <span v-else class="text-gray">不限制</span>
            </div>
          </template>
          <template v-else-if="column.key === 'quota'">
            <span :class="{ 'text-warning': record.imageCount >= record.quota && record.quota > 0 }">
              {{ record.imageCount }} / {{ record.quota === 0 ? '不限' : record.quota }}
            </span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-button size="small" @click="showEditModal(record)">编辑</a-button>
              <a-button size="small" @click="showPasswordModal(record)">改密</a-button>
              <a-popconfirm
                v-if="record.username !== 'admin'"
                title="确定删除此用户？"
                @confirm="handleDelete(record)"
              >
                <a-button size="small" danger>删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 添加/编辑用户弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingUser ? '编辑用户' : '添加用户'"
      @ok="handleSubmit"
      width="600px"
    >
      <a-form layout="vertical" :model="formState">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" required>
              <a-input
                v-model:value="formState.username"
                placeholder="请输入用户名"
                :disabled="editingUser?.username === 'admin'"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="用户名称">
              <a-input v-model:value="formState.name" placeholder="显示名称" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item v-if="!editingUser" label="密码" required>
          <a-input-password v-model:value="formState.password" placeholder="请输入密码（至少6位）" />
        </a-form-item>

        <a-form-item label="说明">
          <a-textarea v-model:value="formState.description" placeholder="用户说明/备注" :rows="2" />
        </a-form-item>

        <a-row :gutter="16" v-if="editingUser?.username !== 'admin'">
          <a-col :span="12">
            <a-form-item label="用户类型">
              <a-select v-model:value="formState.role">
                <a-select-option value="admin">管理员</a-select-option>
                <a-select-option value="user">普通用户</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="可用状态">
              <a-select v-model:value="formState.status">
                <a-select-option :value="1">可用</a-select-option>
                <a-select-option :value="0">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16" v-if="editingUser?.username !== 'admin'">
          <a-col :span="12">
            <a-form-item label="生效日期">
              <a-date-picker v-model:value="formState.validFrom" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="失效日期">
              <a-date-picker v-model:value="formState.validUntil" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item v-if="editingUser?.username !== 'admin'" label="上传限额">
          <a-input-number v-model:value="formState.quota" :min="0" style="width: 200px" />
          <span class="quota-hint">（0表示不限制）</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 修改密码弹窗 -->
    <a-modal
      v-model:open="passwordModalVisible"
      title="修改密码"
      @ok="handlePasswordSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="passwordForm.password" placeholder="请输入新密码（至少6位）" />
        </a-form-item>
        <a-form-item label="确认密码" required>
          <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="请再次输入新密码" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { userApi } from '@/api/user'
import dayjs from 'dayjs'

const loading = ref(false)
const users = ref([])
const modalVisible = ref(false)
const passwordModalVisible = ref(false)
const editingUser = ref(null)

const columns = [
  { title: '用户', key: 'username', width: 180 },
  { title: '类型', key: 'role', width: 100 },
  { title: '状态', key: 'status', width: 80 },
  { title: '有效期', key: 'validity', width: 180 },
  { title: '图片限额', key: 'quota', width: 100 },
  { title: '操作', key: 'actions', width: 180 }
]

const formState = reactive({
  username: '',
  password: '',
  name: '',
  description: '',
  role: 'user',
  status: 1,
  quota: 100,
  validFrom: null,
  validUntil: null
})

const passwordForm = reactive({
  password: '',
  confirmPassword: ''
})

onMounted(() => {
  loadUsers()
})

async function loadUsers() {
  loading.value = true
  try {
    const res = await userApi.getList()
    users.value = res.data || []
  } finally {
    loading.value = false
  }
}

function showAddModal() {
  editingUser.value = null
  Object.assign(formState, {
    username: '',
    password: '',
    name: '',
    description: '',
    role: 'user',
    status: 1,
    quota: 100,
    validFrom: null,
    validUntil: null
  })
  modalVisible.value = true
}

function showEditModal(user) {
  editingUser.value = user
  Object.assign(formState, {
    username: user.username,
    password: '',
    name: user.name || '',
    description: user.description || '',
    role: user.role || 'user',
    status: user.status !== undefined ? user.status : 1,
    quota: user.quota !== undefined ? user.quota : 100,
    validFrom: user.valid_from ? dayjs(user.valid_from) : null,
    validUntil: user.valid_until ? dayjs(user.valid_until) : null
  })
  modalVisible.value = true
}

function showPasswordModal(user) {
  editingUser.value = user
  passwordForm.password = ''
  passwordForm.confirmPassword = ''
  passwordModalVisible.value = true
}

async function handleSubmit() {
  if (!formState.username.trim()) {
    message.warning('请输入用户名')
    return
  }

  if (!editingUser.value && formState.password.length < 6) {
    message.warning('密码至少6位')
    return
  }

  try {
    const data = {
      username: formState.username,
      name: formState.name,
      description: formState.description
    }

    // admin 用户只能修改名称和说明
    if (editingUser.value?.username !== 'admin') {
      data.role = formState.role
      data.status = formState.status
      data.quota = formState.quota
      data.validFrom = formState.validFrom ? formState.validFrom.format('YYYY-MM-DD') : null
      data.validUntil = formState.validUntil ? formState.validUntil.format('YYYY-MM-DD') : null
    }

    if (editingUser.value) {
      await userApi.update(editingUser.value.id, data)
      message.success('用户更新成功')
    } else {
      data.password = formState.password
      await userApi.create(data)
      message.success('用户创建成功')
    }
    modalVisible.value = false
    loadUsers()
  } catch (error) {
    message.error(error.response?.data?.message || '操作失败')
  }
}

async function handlePasswordSubmit() {
  if (passwordForm.password.length < 6) {
    message.warning('密码至少6位')
    return
  }

  if (passwordForm.password !== passwordForm.confirmPassword) {
    message.warning('两次密码输入不一致')
    return
  }

  try {
    await userApi.changePassword(editingUser.value.id, passwordForm.password)
    message.success('密码修改成功')
    passwordModalVisible.value = false
  } catch (error) {
    message.error(error.response?.data?.message || '修改失败')
  }
}

async function handleDelete(user) {
  try {
    await userApi.delete(user.id)
    message.success('用户删除成功')
    loadUsers()
  } catch (error) {
    message.error(error.response?.data?.message || '删除失败')
  }
}
</script>

<style scoped>
.users-page {
  animation: fadeIn 0.3s ease;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.users-table {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar-small {
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.user-name {
  font-weight: 500;
  color: #1e293b;
}

.user-login-name {
  font-size: 12px;
  color: #94a3b8;
}

.validity-cell {
  font-size: 13px;
}

.text-gray {
  color: #94a3b8;
}

.text-warning {
  color: #f59e0b;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.quota-hint {
  margin-left: 8px;
  color: #94a3b8;
  font-size: 12px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>