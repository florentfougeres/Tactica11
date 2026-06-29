import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// On GitHub Pages the app is served from /Tactica11/, but locally (dev/preview)
// we keep the root base so the dev server and Claude preview work unchanged.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Tactica11/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons.svg'],
      manifest: {
        name: 'Tactica11',
        short_name: 'Tactica11',
        description: 'Compos et mises en place tactiques de football.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0e14',
        theme_color: '#0a0e14',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'favicon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'favicon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['**/baniere.png', '**/logo.png', '**/screenshot.png'],
        navigateFallback: 'index.html',
      },
    }),
  ],
}))
