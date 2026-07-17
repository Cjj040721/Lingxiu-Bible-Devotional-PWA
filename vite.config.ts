import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  // Vercel 根路径部署；若部署到 GitHub Pages 项目页，改为 '/<仓库名>/'
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '灵修伴读',
        short_name: '灵修伴读',
        description: '中文和合本圣经阅读 —— 每天与神同行的一小段时光',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#4338ca',
        background_color: '#fafaf9',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 预缓存全部静态资源 + 圣经 JSON（按卷拆分，单文件均 < 2MB）
        globPatterns: ['**/*.{js,css,html,svg,png,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /\/data\/bible\/.+\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bible-data',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
