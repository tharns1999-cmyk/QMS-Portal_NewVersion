import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    tailwindcss(),
    react()
  ],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/services/PeriodicReviewAccessService.js', 'src/services/PeriodicReviewService.js', 'src/store/useStore.js', 'src/pages/PeriodicReviews/**/*.jsx']
    }
  }
}))
