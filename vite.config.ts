import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Закомментируйте base для локального запуска на Windows
  // base: '/web/', 
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Маппинг путей, чтобы исправить ошибку импорта Bot
      '/web/src': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    }
  },
  optimizeDeps: {
    include: ['mermaid'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mermaid') || id.includes('node_modules/@mermaid-js')) {
            return 'mermaid-vendor'
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/rag-api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/rag-api/, ''),
      },
      '/v1/chat': {
        target: 'https://Alem-workspace.gov.kz',
        changeOrigin: true,
        secure: false,
      },
      '/v1/chats': {
        target: 'https://Alem-workspace.gov.kz',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'https://Alem-workspace.gov.kz',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
