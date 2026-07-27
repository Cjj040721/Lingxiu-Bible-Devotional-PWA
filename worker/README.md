# Cloudflare 部署（国内可访问方案）

Vercel（`*.vercel.app`）在国内无法直接访问，故生产环境改用 Cloudflare：
**一个 Worker 同时托管前端静态资源（`dist/`）和 `/api/ask` AI 问答代理**，配置见项目根目录 `wrangler.toml`。

> `*.workers.dev` 默认域名在国内同样不可达，必须绑定自有域名（Cloudflare 解析，国内可直连）。

## 一次性准备

1. 注册 Cloudflare 账号（免费）。
2. 购买域名（阿里云/腾讯云买 .top/.xyz 首年约 ¥10；无需 ICP 备案，因为解析在境外 Cloudflare）。
3. Cloudflare 后台 → Add site → 输入域名 → 按提示把注册商处的 NS 改为 Cloudflare 分配的两个 NS，等待生效（几分钟到几小时）。

## 部署

```bash
cd app
npm run build

npx wrangler login                      # 首次，浏览器授权
npx wrangler secret put OPENAI_API_KEY  # 粘贴大模型 Key（不要写进任何文件）
npx wrangler secret put PASSCODE        # 可选：圈子口令

npx wrangler deploy
```

然后在 Cloudflare 后台 → Workers & Pages → lingxiu-bible → Settings → Domains & Routes → Add Custom Domain，绑定你的域名（自动配好 DNS）。

## 环境变量

| 变量 | 配置方式 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | `wrangler secret put` | ✅ 必填 |
| `PASSCODE` | `wrangler secret put` | 可选：圈子口令 |
| `OPENAI_BASE_URL` | `wrangler.toml` [vars] | 已配置为阿里云兼容端点 |
| `MODEL` | `wrangler.toml` [vars] | 已配置 `deepseek-v3.2` |
| `DAILY_LIMIT` | `wrangler.toml` [vars] | 可选，每 IP 每天限次，默认 20 |

## 前端约定

- 前端 POST `/api/ask`，body：`{ question, context: [{ref, text}], passcode? }`
- `context` 是前端本地检索到的 top N 相关经文（RAG 上下文）
- 返回 OpenAI 兼容 SSE 流；未配置 Key 时返回 501，前端显示「AI 功能待配置」
- 非 `/api/ask` 路径由 `env.ASSETS` 服务 `dist/` 静态资源（SPA 回退见 `wrangler.toml`）

## 日常更新

```bash
npm run build && npx wrangler deploy
```
