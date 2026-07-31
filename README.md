# 灵修伴读（Lingxiu Bandu）

> 非盈利、给基督徒小圈子（10-100 人）使用的中文圣经阅读 PWA。
> 微信里打开链接 → 添加到主屏幕，体验接近原生 App。圣经采用公有领域的中文和合本（1919）。

## 功能（V1）

- 📖 **圣经阅读**：和合本 66 卷完整经文（旧约 39 + 新约 27），卷 → 章 → 经文三级导航；字号 4 档、夜间模式（localStorage 记忆）；左右滑动翻章；跨卷上一章/下一章
- ✨ **每日金句**：69 节精选经文按日期轮换（从圣经数据原样抽取生成）
- 🗓️ **读经计划 + 打卡**：一年整本 / 90 天新约 / 30 天福音书；进度条、连续天数 streak、打卡日历（可补打）；数据存本地
- 🔍 **全文搜索**：关键词搜全部经文，分批加载边搜边出结果，高亮命中，点击跳转
- ✏️ **笔记与书签**：阅读页点击任一节 → 复制（带出处）/ 书签 / 笔记 / 分享卡片；时间线管理、可导出 JSON
- 🖼️ **金句卡片**：Canvas 生成分享图（3 套模板），保存 PNG
- 💬 **AI 灵修问答**：对话式 UI + 快捷提问；前端本地检索相关经文作 RAG 上下文；Cloudflare Worker 代理（Key 不下发、限流、圈子口令）；对话只存本地；**未配置时优雅提示**
- 📜 **注解框架**：阅读页每章可展开注解区；数据按卷放在 `public/data/commentary/`，没有文件时显示「整理中」
- 📱 **PWA**：manifest + Service Worker 全量预缓存（含圣经数据），离线可用；添加到主屏幕

## 本地开发

```bash
cd app
npm install          # 首次
npm run dev          # 开发服务器（默认 http://localhost:5173）
npm run build        # 产物到 dist/（含 PWA）
npm run preview      # 本地预览构建产物
```

常用数据脚本：

```bash
npm run convert:bible    # 原始和合本 JSON → public/data/bible/（按卷拆分 + 索引）
npm run validate:bible   # 数据完整性校验（66 卷/1189 章/31100 节位 + 25 处关键经文抽检）
npm run build:verses     # 从圣经数据生成每日金句 src/data/daily-verses.json
node scripts/generate-icons.mjs   # 重新生成 PWA 占位图标
```

## 部署（Cloudflare Workers，生产环境）

生产地址：**<https://lingxiubible.top>**（Cloudflare 自有域名，国内可直连）。

> Vercel 方案已弃用：`*.vercel.app` 在国内无法直接访问。`vercel.json` 与 `api/ask.js`（Vercel Serverless 版代理）仅作存档保留，不再维护。

架构：**一个 Cloudflare Worker 同时承担 ① 托管 `dist/` 静态前端（Workers Static Assets）② `/api/ask` AI 问答代理**，配置见根目录 `wrangler.toml`，详细部署步骤见 `worker/README.md`。

### 日常更新

```bash
cd app
npm run build && npx wrangler deploy
```

首次部署需 `npx wrangler login`，并用 `npx wrangler secret put OPENAI_API_KEY` 配置大模型 Key（不要写进任何文件）。

### 环境变量

| 变量 | 配置方式 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `OPENAI_API_KEY` | `wrangler secret put` | ✅ | — | 大模型 Key。当前用阿里云百炼（DeepSeek 兼容端点），申请：<https://bailian.console.aliyun.com/> |
| `OPENAI_BASE_URL` | `wrangler.toml` [vars] | 否 | 已配置阿里云兼容端点 | OpenAI 兼容接口地址，换别家模型改这里 |
| `MODEL` | `wrangler.toml` [vars] | 否 | `deepseek-v3.2` | 模型名 |
| `PASSCODE` | `wrangler secret put` | 否 | — | 圈子口令；设置后用户需在问答页输入口令才能提问，防止链接外传被刷。**当前未启用**（自用阶段），需要时随时可配，无需改代码 |
| `DAILY_LIMIT` | `wrangler.toml` [vars] | 否 | `20` | 每 IP 每天提问上限 |

> 改完 `wrangler.toml` 的 [vars] 后要重新 `npx wrangler deploy` 才生效；secret 改完即生效。未配置 `OPENAI_API_KEY` 时，问答页显示「AI 功能待配置」，其余功能不受影响。

### 路由与 PWA 说明

- SPA 回退由 `wrangler.toml` 的 `[assets] not_found_handling = "single-page-application"` 处理；`/api/ask` 由 Worker 代码接管
- `vite.config.ts` 中 `base: '/'`；PWA Service Worker 全量预缓存（含圣经数据），离线可用

## 配置 AI 问答

代理代码在 `worker/ask.js`（Cloudflare Worker，生产用；`api/ask.js` 是已弃用的 Vercel 版存档）。环境变量见上表。机制：

- 前端提问前先在本地检索 top 8 相关经文，随问题一起 POST 到 `/api/ask`
- 代理拼接系统指令（只依据经文与公有领域注解回答、标注出处、争议话题中立、末尾固定免责语）后调用大模型
- 回答以 OpenAI 兼容 SSE 流式返回（前端同时兼容非流式 JSON）
- 对话记录只存用户设备 localStorage，服务器不留存

## 圣经数据说明

- 来源：[xucz1109/bible-zh-cuvs](https://github.com/xucz1109/bible-zh-cuvs)（上游 [haitai/bible](https://github.com/haitai/bible)），简体和合本，公有领域
- 已做严格清洗与交叉验证：
  - 与独立繁体数据源（thiagobodruk/bible）+ wordproject.org 在线和合本逐章比对
  - 和合本印刷版的「合节」（多节合并，如 诗8:6-8、弗6:2-3）以区间格式 `{v, end, t}` 保留
  - 源数据唯一一处真实缺文（约书亚记 3:10-11）已依 wordproject.org 补回
  - `npm run validate:bible` 全量校验：66 卷 / 1189 章 / 31100 节位 / 31032 条目 + 25 处关键经文 + 简体确认
- 格式：`public/data/bible/index.json`（卷索引）+ `books/{bookId}.json`（单卷，按需加载）

```jsonc
// books/gen.json
{ "bookId": "gen", "name": "创世记", "abbr": "创", "testament": "old", "order": 1,
  "chapters": [ { "chapter": 1, "verses": [ { "v": 1, "t": "起初神创造天地。" } ] } ] }
// 合节示例：{ "v": 6, "end": 8, "t": "……" } 表示 6-8 节合并
```

## 注解数据格式

文件：`public/data/commentary/{bookId}.json`（没有该文件的卷显示「整理中」）

```jsonc
{ "bookId": "mat", "source": "马太亨利简明圣经注释（1706 年原著，公有领域）· AI 中译",
  "chapters": [ { "chapter": 5, "sections": [ { "verses": "1-12", "text": "……" } ] } ] }
```

内容来源：马太亨利简明圣经注释（MHCC，1706 年原著，公有领域）英文原文，经 AI 批量翻译为简体中文（术语对齐和合本）。覆盖范围：全本 66 卷（V1 为新约 27 卷 + 诗篇 + 箴言，CAO-20 扩充旧约其余 37 卷）。另有 `public/data/commentary-verses/` 逐节简注（依据 MHCC 中译 + 经文由 AI 生成，含义/见解/应用三段式）。

数据管道（详见 `scripts/raw/mhcc/SOURCE.md`）：
1. `npm run convert:commentary` — 解析 MHCC 英文原文（`scripts/raw/mhcc/src/`）→ 英文中间数据 `scripts/raw/commentary-en/`
2. `npm run translate:commentary` — 调 OpenAI 兼容接口（默认 DeepSeek）翻译 → `public/data/commentary/`（需 `.env.local` 配置 `OPENAI_API_KEY`，支持断点续传）
3. `npm run validate:commentary` — 校验章号连续、verses 格式、text 非空、单卷 < 500KB

## 目录结构

```
app/
├── public/
│   ├── data/bible/          # 圣经数据（index.json + books/*.json，PWA 预缓存）
│   ├── data/commentary/     # 注解数据（预留，按卷）
│   ├── icons/               # PWA 图标（脚本生成）
│   └── favicon.svg
├── src/
│   ├── components/          # TabBar / Modal / 选节操作菜单 / 卡片弹窗
│   ├── data/daily-verses.json  # 每日金句（脚本生成）
│   ├── lib/                 # bible(数据访问) settings plans marks search ai card commentary store
│   ├── pages/               # Home Books Chapters Read Search Plans Notes Ask
│   ├── types/bible.ts
│   ├── App.tsx / main.tsx / index.css
│   └── index.html（项目根）
├── scripts/                 # 数据管道：convert/validate/compare/icons/verses（node 直接运行）
├── worker/                  # Cloudflare Worker：AI 问答代理 + 部署说明
├── vite.config.ts           # Vite + Tailwind + PWA 配置
└── README.md
```

本地存储键位（localStorage）：`lingxiu.settings.v1`（字号/夜间）、`lingxiu.plan.v1`（计划/打卡）、`lingxiu.marks.v1`（笔记/书签）、`lingxiu.chats.v1`（AI 对话）、`lingxiu.ask.passcode`。

## 合规与版权

- 圣经：和合本（1919），公有领域 ✅
- 注解：仅收录公有领域释经资料（马太亨利等），收录前核对所用中译本版权状态
- AI 回答：固定带「仅供参考，请与牧者交通」免责；经圈子口令 + 限流控制使用范围
- 仅小圈子分享链接使用，不公开推广、不上架应用商店
