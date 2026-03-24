<template>
  <div class="users-page">
    <div class="page-header">
      <div class="header-content">
        <h2>用户管理</h2>
        <p>管理系统管理员账号</p>
      </div>
      <a-button type="primary" @click="showAddModal">
        <PlusOutlined /> 添加用户
      </a-button>
    </div>

    <div class="users-grid">
      <div v-for="user in users" :key="user.id" class="user-card">
        <div class="user-avatar">
          {{ user.username.charAt(0).toUpperCase() }}
        </div>
        <div class="user-info">
          <div class="user-name">{{ user.username }}</div>
          <div class="user-date">创建于 {{ formatDate(user.created_at) }}</div>
        </div>
        <div class="user-actions">
          <a-button size="small" @click="showPasswordModal(user)">修改密码</a-button>
          <a-button size="small" @click="showEditModal(user)">编辑</a-button>
          <a-popconfirm
            title="确定删除此用户？"
            @confirm="handleDelete(user)"
            :disabled="user.id === currentUserId"
          >
            <a-button size="small" danger :disabled="user.id === currentUserId">删除</a-button>
          </a-popconfirm>
        </div>
      </div>
    </div>

    <!-- 添加/编辑用户弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingUser ? '编辑用户' : '添加用户'"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="用户名" required>
          <a-input v-model:value="formState.username" placeholder="请输入用户名" size="large" />
        </a-form-item>
        <a-form-item v-if="!editingUser" label="密码" required>
          <a-input-password v-model:value="formState.password" placeholder="请输入密码（至少6位）" size="large" />
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
          <a-input-password v-model:value="passwordForm.password" placeholder="请输入新密码（至少6位）" size="large" />
        </a-form-item>
        <a-form-item label="确认密码" required>
          <a-input-password v-model:value="passwordForm.confirmPassword" placeholder="请再次输入新密码" size="large" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { userApi } from '@/api/user'
import { useUserStore } from '@/stores/user'
import dayjs from 'dayjs'

const userStore = useUserStore()
const currentUserId = computed(() => userStore.user?.id)

const loading = ref(false)
const users = ref([])
const modalVisible = ref(false)
const passwordModalVisible = ref(false)
const editingUser = ref(null)

const formState = reactive({
  username: '',
  password: ''
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
  formState.username = ''
  formState.password = ''
  modalVisible.value = true
}

function showEditModal(user) {
  editingUser.value = user
  formState.username = user.username
  formState.password = ''
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
    if (editingUser.value) {
      await userApi.update(editingUser.value.id, { username: formState.username })
      message.success('用户更新成功')
    } else {
      await userApi.create({
        username: formState.username,
        password: formState.password
      })
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
    message.error('修改失败')
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

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD')
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

.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.user-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.user-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}

.user-avatar {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.user-date {
  font-size: 13px;
  color: #94a3b8;
}

.user-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>