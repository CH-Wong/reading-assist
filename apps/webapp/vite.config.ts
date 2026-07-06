/**
 * Reading Assist — Web App (Vite config)
 *
 * Proxies /api/deepseek/* to the DeepSeek API to avoid CORS issues
 * during development. In production (AWS CloudFront), a CloudFront
 * Function handles the same rewrite.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@reading-assist/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
})
