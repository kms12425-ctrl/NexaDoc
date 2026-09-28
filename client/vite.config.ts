import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Yjs WebSocket 代理——客户端连接 ws://localhost:5173/yjs/<docId>
      // Vite 代理到后端 ws://localhost:3001
      '/yjs': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
