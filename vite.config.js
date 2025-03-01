import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      buffer: 'buffer',
      process: 'process/browser',
      util: 'util',
      stream: 'stream-browserify',
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  define: {
    'process.env.NODE_DEBUG': 'false',
    global: 'window',
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['aws-crt'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          aws: ['@aws-sdk/client-s3', '@aws-sdk/lib-storage']
        },
      },
    },
  },
  optimizeDeps: {
    include: ['buffer', 'process/browser'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
});
