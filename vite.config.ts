import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * 本地开发用的 /api/ask 中间件：直接复用 api/ask.js（Vercel Serverless 处理器），
 * 环境变量从 .env.local 读取（与 Vercel 后台配置同名）。仅 dev server 生效。
 */
function devAskApi(): Plugin {
  return {
    name: 'dev-ask-api',
    configureServer(server) {
      server.middlewares.use('/api/ask', async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const { default: handler } = (await import('./api/ask.js')) as {
          default: (req: unknown, res: unknown) => Promise<void>;
        };
        const mockReq = { method: req.method, headers: req.headers, body: raw ? JSON.parse(raw) : {} };
        const mockRes = {
          statusCode: 200,
          setHeader: (k: string, v: string) => res.setHeader(k, v),
          status(code: number) {
            this.statusCode = code;
            return this;
          },
          json(obj: unknown) {
            res.statusCode = this.statusCode;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          },
          end() {
            res.statusCode = this.statusCode;
            res.end();
          },
        };
        await handler(mockReq, mockRes);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 让 api/ask.js 在本地 dev 时也能读到 OPENAI_API_KEY 等变量（.env.local 已被 gitignore）
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    // Vercel 根路径部署；若部署到 GitHub Pages 项目页，改为 '/<仓库名>/'
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      devAskApi(),
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
  };
});
