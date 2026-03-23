<template>
  <div class="users-page">
    <a-page-header title="用户管理">
      <template #extra>
        <a-button type="primary" @click="showAddModal">
          <PlusOutlined /> 添加用户
        </a-button>
      </template>
    </a-page-header>

    <a-table
      :columns="columns"
      :data-source="users"
      :loading="loading"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'createdAt'">
          {{ formatDate(record.created_at) }}
        </template>
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button type="link" size="small" @click="showPasswordModal(record)">
              修改密码
            </a-button>
            <a-button type="link" size="small" @click="showEditModal(record)">
              编辑
            </a-button>
            <a-popconfirm
              title="确定删除此用户？"
              @confirm="handleDelete(record)"
              :disabled="record.id === currentUserId"
            >
              <a-button type="link" size="small" danger :disabled="record.id === currentUserId">
                删除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 添加/编辑用户弹窗 -->
    <a-modal
      v-model:open="modalVisible"
      :title="editingUser ? '编辑用户' : '添加用户'"
      @ok="handleSubmit"
    >
      <a-form layout="vertical">
        <a-form-item label="用户名" required>
          <a-input v-model:value="formState.username" placeholder="请输入用户名" />
        </a-form-item>
        <a-form-item v-if="!editingUser" label="密码" required>
          <a-input-password v-model:value="formState.password" placeholder="请输入密码（至少6位）" />
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

const columns = [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: '用户名', dataIndex: 'username' },
  { title: '创建时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 200 }
]

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
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}
</script>