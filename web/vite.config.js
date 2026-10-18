import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 默认代理到本地后端 3000；本地自测可临时用 VITE_API_PROXY 指到别的端口
const apiTarget = process.env.VITE_API_PROXY || 'http://localhost:3000'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
})
