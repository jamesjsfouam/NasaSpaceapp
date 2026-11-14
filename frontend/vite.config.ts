import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, /api se redirige al backend de FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
