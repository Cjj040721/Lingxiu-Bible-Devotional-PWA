# AI 灵修问答代理（Cloudflare Worker）

把 `ask.js` 部署为 Cloudflare Worker，并把前端站点托管在同一域名下（或配置路由让 `/api/ask` 指向本 Worker）。

## 部署步骤

```bash
cd worker
npm install -g wrangler   # 如未安装
wrangler login

# 创建 worker（首次）
wrangler init --yes --type javascript-module lingxiu-ask || true
# 将 ask.js 内容作为 worker 入口（src/index.js 或直接替换）

# 配置密钥与环境变量
wrangler secret put OPENAI_API_KEY     # 粘贴你的大模型 Key（不要写进任何文件）
wrangler secret put PASSCODE           # 可选：圈子口令
# 非密钥变量写在 wrangler.toml 的 [vars] 里：
# OPENAI_BASE_URL = "https://api.deepseek.com/v1"  # 可选，兼容网关可换
# MODEL = "deepseek-chat"                          # 可选

wrangler deploy
```

## 环境变量说明

| 变量 | 必填 | 说明 |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI 兼容接口 Key（GPT-4o-mini / Claude Haiku / 国产模型网关均可） |
| `OPENAI_BASE_URL` | 否 | 默认 `https://api.openai.com/v1`，可改为兼容网关地址 |
| `MODEL` | 否 | 默认 `gpt-4o-mini` |
| `PASSCODE` | 否 | 设置后，前端需输入正确口令才能提问（防链接外传被刷） |
| `DAILY_LIMIT` | 否 | 每 IP 每天限次，默认 20（内存计数；多实例严格限流请接 Workers KV） |

## 前端约定

- 前端 POST `/api/ask`，body：`{ question, context: [{ref, text}], passcode? }`
- `context` 是前端本地检索到的 top N 相关经文（RAG 上下文）
- 返回 OpenAI 兼容 SSE 流；未配置 Key 时返回 501，前端显示「AI 功能待配置」

## 部署在 Vercel 的替代方案

若用 Vercel 托管前端，可在项目根建 `api/ask.js`（Vercel Functions），逻辑相同：
读取 `process.env.OPENAI_API_KEY` 等环境变量，按上述 Prompt 拼接调用即可。
