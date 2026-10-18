import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // A porta onde o FastAPI está rodando
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
