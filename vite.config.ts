import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/plaatijzer/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-180.png'],
      manifest: {
        name: 'Plaatijzer',
        short_name: 'Plaatijzer',
        description: 'Workout- en gewichtslog voor de homegym',
        lang: 'nl',
        theme_color: '#0A0A0B',
        background_color: '#0A0A0B',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/plaatijzer/',
        scope: '/plaatijzer/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Start workout', url: '/plaatijzer/#/' },
          { name: 'Log gewicht', url: '/plaatijzer/#/?log=1' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/plaatijzer/index.html',
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
