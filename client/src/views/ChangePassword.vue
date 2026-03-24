<template>
  <div class="change-password-page">
    <div class="page-header">
      <h2>修改密码</h2>
    </div>

    <div class="form-container">
      <a-form
        :model="formState"
        :rules="rules"
        layout="vertical"
        @finish="handleSubmit"
      >
        <a-form-item label="当前密码" name="oldPassword">
          <a-input-password
            v-model:value="formState.oldPassword"
            placeholder="请输入当前密码"
            size="large"
          />
        </a-form-item>

        <a-form-item label="新密码" name="newPassword">
          <a-input-password
            v-model:value="formState.newPassword"
            placeholder="请输入新密码"
            size="large"
          />
        </a-form-item>

        <a-form-item label="确认新密码" name="confirmPassword">
          <a-input-password
            v-model:value="formState.confirmPassword"
            placeholder="请再次输入新密码"
            size="large"
          />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit" size="large" :loading="loading">
            确认修改
          </a-button>
          <a-button size="large" style="margin-left: 16px" @click="$router.back()">
            取消
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { userApi } from '@/api/user'

const router = useRouter()
const loading = ref(false)

const formState = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = async (rule, value) => {
  if (value !== formState.newPassword) {
    return Promise.reject('两次输入的密码不一致')
  }
  return Promise.resolve()
}

const rules = {
  oldPassword: [
    { required: true, message: '请输入当前密码' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码' },
    { min: 6, message: '密码长度至少6位' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码' },
    { validator: validateConfirmPassword }
  ]
}

async function handleSubmit() {
  loading.value = true
  try {
    await userApi.changeOwnPassword({
      oldPassword: formState.oldPassword,
      newPassword: formState.newPassword
    })
    message.success('密码修改成功，请重新登录')
    router.push('/login')
  } catch (error) {
    message.error(error.response?.data?.message || '密码修改失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.change-password-page {
  max-width: 500px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
}

.form-container {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
</style>