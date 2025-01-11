import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      util: path.resolve(__dirname, 'node_modules/util/'),
      stream: path.resolve(__dirname, 'node_modules/stream-browserify'),
      buffer: path.resolve(__dirname, 'node_modules/buffer/'),
      process: path.resolve(__dirname, 'node_modules/process/browser'),
      events: path.resolve(__dirname, 'node_modules/events/'),
      path: path.resolve(__dirname, 'node_modules/path-browserify'),
      crypto: path.resolve(__dirname, 'node_modules/crypto-browserify'),
      https: path.resolve(__dirname, 'node_modules/https-browserify'),
      http: path.resolve(__dirname, 'node_modules/stream-http'),
      os: path.resolve(__dirname, 'node_modules/os-browserify/browser'),
      assert: path.resolve(__dirname, 'node_modules/assert/'),
      constants: path.resolve(__dirname, 'node_modules/constants-browserify'),
      zlib: path.resolve(__dirname, 'node_modules/browserify-zlib'),
    },
  },
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      external: ['util'],
    },
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
