import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, /api se redirige al backend de FastAPI.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'recharts'
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
        },
      },
    },
  },
  server: {
    proxy: { '/api': 'http://localhost:8000' },
  },
})
