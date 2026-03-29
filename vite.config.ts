import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    allowedHosts: ['heterotelic-haylee-nonepically.ngrok-free.dev'],
    proxy: {
      '/bounties': 'http://localhost:8002',
      '/bets': 'http://localhost:8002',
      '/proof': 'http://localhost:8002',
      '/profile': 'http://localhost:8002',
    },
  },
})
