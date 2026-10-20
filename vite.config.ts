import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// On GitHub Pages the app is served from /Tactica11/. Everywhere else (dev,
// local preview, Netlify/Vercel/Cloudflare Pages) it's served from the domain
// root, so the GH Pages subpath is opt-in via DEPLOY_TARGET=gh-pages.
export default defineConfig(() => ({
  base: process.env.DEPLOY_TARGET === 'gh-pages' ? '/Tactica11/' : '/',
  plugins: [
    react(),
    // The macOS app (Tauri sets TAURI_ENV_PLATFORM) is already offline and
    // installed: no service worker / web manifest there.
    !process.env.TAURI_ENV_PLATFORM &&
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
