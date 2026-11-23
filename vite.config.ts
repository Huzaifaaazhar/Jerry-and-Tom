/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          rapier: ['@react-three/rapier'],
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
