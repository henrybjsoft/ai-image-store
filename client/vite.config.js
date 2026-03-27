import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd())
  // BASE_URL 环境变量，默认为空，示例：/bj-images
  const baseUrl = env.VITE_BASE_URL || ''
  // Vite 的 base 需要末尾有 /
  const base = baseUrl ? `${baseUrl}/` : '/'

  return {
    plugins: [vue()],
    base,
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    build: {
      outDir: '../server/public',
      emptyOutDir: true
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/uploads': {
          target: 'http://localhost:3000',
          changeOrigin: true
        }
      }
    }
  }
})