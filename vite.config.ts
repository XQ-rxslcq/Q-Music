import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  root: path.join(__dirname, 'src/renderer'),
  publicDir: path.join(__dirname, 'assets'),
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src/renderer'),
    },
  },
  build: {
    outDir: path.join(__dirname, 'dist-renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'src/renderer/index.html'),
        'desktop-lyrics': path.join(__dirname, 'src/renderer/desktop-lyrics.html'),
      },
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.join(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron'),
            rollupOptions: {
              external: ['electron'],
              output: {
                entryFileNames: 'main.js',
                // 单文件打包，避免 asar 内动态 chunk 找不到
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, 'src/preload/preload.ts'),
        vite: {
          build: {
            outDir: path.join(__dirname, 'dist-electron'),
            rollupOptions: {
              output: {
                entryFileNames: 'preload.cjs',
                format: 'cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      renderer: {},
    }),
  ],
  server: {
    port: 5173,
  },
  // 打包给 electron-builder 时用相对 base
  base: './',
})
