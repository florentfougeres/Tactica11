import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// On GitHub Pages the app is served from /Tactica11/, but locally (dev/preview)
// we keep the root base so the dev server and Claude preview work unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Tactica11/' : '/',
  plugins: [react()],
}))
