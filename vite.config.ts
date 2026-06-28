import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow access from LAN devices (mobile testing)
    proxy: {
      // Proxy DeepSeek API calls to avoid CORS issues
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
})
