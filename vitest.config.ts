import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    name: 'q-music-regression',
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, 'src/core'),
    },
  },
})
