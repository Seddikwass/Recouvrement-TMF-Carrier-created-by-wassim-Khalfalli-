import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The preview proxy forwards the public hostname (Host header) and the page
// origin, so both must be allowed when running inside the Base44 sandbox.
const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN
const previewMode = process.env.BASE44_PREVIEW_MODE === '1'
const allowedHosts =
  previewMode && sandboxDomain ? [`.${sandboxDomain}`] : []

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
    ...(previewMode ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
  },
})
