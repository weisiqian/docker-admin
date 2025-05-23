import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/docker-api': {
        target: 'http://127.0.0.1:2375',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/docker-api/, ''),
        // 允许代理处理大型请求体
        proxyTimeout: 1800000, // 30分钟超时
        // 确保正确传递Content-Type头
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.log('代理错误:', err.message)
            console.log('请求URL:', req.url)

            // 检查是否是Docker daemon连接问题
            if ((err as any).code === 'ECONNREFUSED') {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  message:
                    'Docker daemon连接被拒绝。请确保Docker Desktop正在运行，并且Docker API在端口2375上可用。',
                }),
              )
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  message: `代理错误: ${err.message}`,
                }),
              )
            }
          })

          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`代理请求: ${req.method} ${req.url}`)

            // 确保正确传递Content-Type头部
            if (req.headers['content-type']) {
              proxyReq.setHeader('Content-Type', req.headers['content-type'])
            }

            // 对于构建请求，确保正确的头部
            if (req.url?.includes('/build')) {
              console.log('Docker构建请求，设置正确的头部')
              // Docker API需要这些头部
              proxyReq.setHeader('X-Registry-Config', '{}')
            }
          })

          proxy.on('proxyRes', (proxyRes, req, _res) => {
            const statusCode = proxyRes.statusCode || 0
            console.log(`代理响应: ${req.method} ${req.url} - ${statusCode}`)

            // 如果是错误响应，记录更多信息
            if (statusCode >= 400) {
              console.log('错误响应头部:', proxyRes.headers)
            }
          })
        },
      },
    },
  },
})
