import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // jsPDF is only reached through import() (PDF export); pre-bundle it so the
  // dev server does not discover it on the first click and reload the page,
  // which would drop a generated report.
  optimizeDeps: { include: ['jspdf'] },
  // Local Ollama for AI-drafted narratives (dev server only; avoids CORS)
  server: {
    proxy: {
      '/ollama': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/ollama/, ''),
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
})
