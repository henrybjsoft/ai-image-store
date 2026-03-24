<template>
  <div class="login-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      <div class="bg-circle circle-3"></div>
    </div>

    <div class="login-card">
      <!-- 左侧装饰 -->
      <div class="login-left">
        <div class="brand">
          <div class="logo-icon">
            <PictureOutlined />
          </div>
          <h1>图片素材管理系统</h1>
        </div>
        <p class="brand-desc">智能分类 · 快速检索 · 高效管理</p>

        <div class="features">
          <div class="feature-item">
            <div class="feature-icon"><CloudUploadOutlined /></div>
            <div class="feature-text">
              <h4>批量上传</h4>
              <p>支持拖拽上传，自动识别分类</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><SearchOutlined /></div>
            <div class="feature-text">
              <h4>智能搜索</h4>
              <p>关键词搜索 + 自然语言搜索</p>
            </div>
          </div>
          <div class="feature-item">
            <div class="feature-icon"><RobotOutlined /></div>
            <div class="feature-text">
              <h4>AI 识别</h4>
              <p>自动分析图片内容并分类</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="login-right">
        <div class="login-form-wrapper">
          <h2>欢迎回来</h2>
          <p class="login-subtitle">请登录您的账号</p>

          <a-form
            :model="formState"
            @finish="handleLogin"
            layout="vertical"
          >
            <a-form-item
              name="username"
              :rules="[{ required: true, message: '请输入用户名' }]"
            >
              <div class="input-wrapper">
                <UserOutlined class="input-icon" />
                <a-input
                  v-model:value="formState.username"
                  size="large"
                  placeholder="用户名"
                  class="custom-input"
                />
              </div>
            </a-form-item>

            <a-form-item
              name="password"
              :rules="[{ required: true, message: '请输入密码' }]"
            >
              <div class="input-wrapper">
                <LockOutlined class="input-icon" />
                <a-input-password
                  v-model:value="formState.password"
                  size="large"
                  placeholder="密码"
                  class="custom-input"
                />
              </div>
            </a-form-item>

            <a-form-item>
              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="loading"
                class="login-btn"
              >
                登 录
              </a-button>
            </a-form-item>
          </a-form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined, PictureOutlined, CloudUploadOutlined, SearchOutlined, RobotOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)

const formState = reactive({
  username: '',
  password: ''
})

async function handleLogin() {
  loading.value = true
  try {
    const res = await userStore.login(formState.username, formState.password)
    if (res.success) {
      message.success('登录成功')
      router.push('/')
    } else {
      message.error(res.message || '登录失败')
    }
  } catch (error) {
    message.error('登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.1;
}

.circle-1 {
  width: 600px;
  height: 600px;
  background: white;
  top: -200px;
  right: -100px;
}

.circle-2 {
  width: 400px;
  height: 400px;
  background: white;
  bottom: -100px;
  left: -100px;
}

.circle-3 {
  width: 200px;
  height: 200px;
  background: white;
  top: 50%;
  left: 20%;
}

.login-card {
  display: flex;
  background: white;
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  width: 900px;
  max-width: 95%;
  animation: fadeIn 0.5s ease;
}

.login-left {
  flex: 1;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: white;
}

.brand {
  margin-bottom: 16px;
}

.logo-icon {
  width: 64px;
  height: 64px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin-bottom: 20px;
  backdrop-filter: blur(10px);
}

.brand h1 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.brand-desc {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 40px;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateX(5px);
}

.feature-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.feature-text h4 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.feature-text p {
  font-size: 13px;
  opacity: 0.8;
  margin: 0;
}

.login-right {
  flex: 1;
  padding: 60px 50px;
  display: flex;
  align-items: center;
}

.login-form-wrapper {
  width: 100%;
}

.login-form-wrapper h2 {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 8px;
}

.login-subtitle {
  color: #64748b;
  margin-bottom: 32px;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  z-index: 1;
  font-size: 16px;
}

.custom-input {
  padding-left: 44px !important;
  border-radius: 12px !important;
  border: 2px solid #e2e8f0 !important;
  transition: all 0.2s ease !important;
}

.custom-input:hover {
  border-color: #cbd5e1 !important;
}

.custom-input:focus {
  border-color: #6366f1 !important;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
}

.login-btn {
  height: 48px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4) !important;
  transition: all 0.3s ease !important;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5) !important;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 768px) {
  .login-card {
    flex-direction: column;
  }

  .login-left {
    padding: 40px 30px;
  }

  .login-right {
    padding: 40px 30px;
  }

  .features {
    display: none;
  }
}
</style>