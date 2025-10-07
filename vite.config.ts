import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Postal Code Netherlands',
        short_name: 'NL Postcode',
        // Use relative URLs so deployment under a subpath works (e.g., GitHub Pages /<repo>/)
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1d4ed8',
        description: "View addresses on a map for Dutch postal codes.",
        orientation: "natural",
        screenshots: [
          {
            "src": "screenshots/Screenshot_20251007-145205.png",
            "sizes": "1080x2400",
            "type": "image/png"
          },
          {
            "src": "screenshots/Screenshot_20251007-145214.png",
            "sizes": "1080x2400",
            "type": "image/png"
          },
          {
            "src": "screenshots/Screenshot_20251007-145428.png",
            "sizes": "1080x2400",
            "type": "image/png"
          }
        ],
        icons: [
          {
            "src": "icons/icon_512x512.png",
            "sizes": "512x512",
            "type": "image/png"
          },
          {
            "src": "icons/icon_192x192.png",
            "sizes": "192x192",
            "type": "image/png"
          },
          {
            "src": "favicon.ico",
            "sizes": "48x48 64x64 96x96",
            "type": "image/x-icon"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
