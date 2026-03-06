import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.WASP_API_URL': JSON.stringify(process.env.WASP_API_URL),
      'process.env.WEBSITE_URL': JSON.stringify(process.env.WEBSITE_URL)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          'area-selector': resolve(__dirname, 'src/renderer/area-selector.html')
        }
      }
    }
  }
})
