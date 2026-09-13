import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vercelToolbar } from '@vercel/toolbar/plugins/vite'
export default defineConfig({plugins:[react(),vercelToolbar()],server:{host:true}})
