import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfills for Node.js built-in modules
      util: 'util/',
      stream: 'stream-browserify',
      buffer: 'buffer/',
      process: 'process/browser',
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          firebase: ['firebase/app', 'firebase/auth'],
          aws: ['@aws-sdk/client-s3', '@aws-sdk/lib-storage']
        }
      }
    }
  }
})
