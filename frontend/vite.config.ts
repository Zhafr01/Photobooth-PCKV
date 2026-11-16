import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/PhotoboothPCKV/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // mengizinkan akses dari jaringan lokal
    allowedHosts: true, // mengizinkan tunnel seperti localtunnel, ngrok, dll.
  },
})
