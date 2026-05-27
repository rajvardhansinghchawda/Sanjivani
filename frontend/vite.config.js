import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/static/', // Set base prefix for serving assets from Django static root
  build: {
    outDir: '../backend/staticfiles', // Output built assets directly to Django static files directory
    emptyOutDir: true, // Empty staticfiles directory before build
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    allowedHosts: [
      'f60d-2401-4900-8823-7c14-85cc-7204-2cf1-6473.ngrok-free.app',
      '01bb-115-244-175-78.ngrok-free.app',
    ],
  },
})
