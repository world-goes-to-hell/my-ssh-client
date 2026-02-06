import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function copyCryptoPlugin() {
  return {
    name: 'copy-crypto',
    closeBundle() {
      fs.mkdirSync(path.resolve(__dirname, 'out/main/src'), { recursive: true })
      fs.copyFileSync(
        path.resolve(__dirname, 'src/crypto.js'),
        path.resolve(__dirname, 'out/main/src/crypto.js')
      )
    }
  }
}

export default defineConfig({
  main: {
    plugins: [copyCryptoPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'main.js')
        }
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/preload.js')
        }
      }
    }
  },
  renderer: {
    root: path.resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
