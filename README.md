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

## 部署（Vercel，方案 A）

前端托管在 Vercel，AI 代理由 `api/ask.js`（Vercel Serverless Function）提供，同域名 `/api/ask`，无需额外网关。

### 方式一：Git + Vercel 网页导入（推荐）

1. 把本目录（`app/`）推到 GitHub/GitLab 仓库
2. [vercel.com](https://vercel.com) → Add New → Project → 导入该仓库
3. Vercel 会自动识别 Vite：Build Command `npm run build`，Output `dist`（保持默认即可）
4. Deploy。完成后访问分配的域名即可（微信里打开 → 添加到主屏幕）

### 方式二：命令行

```bash
cd app
npx vercel          # 首次按提示登录、选择 scope，直接部署预览
npx vercel --prod   # 发布到生产域名
```

### 必须配置的环境变量（Vercel → Project → Settings → Environment Variables）

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `OPENAI_API_KEY` | ✅ | — | 大模型 Key。DeepSeek 申请地址：<https://platform.deepseek.com/api_keys>（注册 → 充值少量金额 → 创建 API Key） |
| `OPENAI_BASE_URL` | 否 | `https://api.deepseek.com/v1` | OpenAI 兼容接口地址，换别家模型改这里 |
| `MODEL` | 否 | `deepseek-chat` | 模型名 |
| `PASSCODE` | 否 | — | 圈子口令；设置后用户需在问答页输入口令才能提问，防止链接外传被刷 |
| `DAILY_LIMIT` | 否 | `20` | 每 IP 每天提问上限 |

> 改完环境变量后要 **Redeploy** 一次才会生效。未配置 `OPENAI_API_KEY` 时，问答页显示「AI 功能待配置」，其余功能不受影响。

### 路由与 PWA 说明

- `vercel.json` 已配置 SPA 回退：除 `/api/*` 外所有路径回退到 `index.html`（静态资源与 `/api/ask` 不受影响）
- `vite.config.ts` 中 `base: '/'`，适配 Vercel 根路径部署；PWA Service Worker 全量预缓存（含圣经数据），离线可用

### 备选：Cloudflare Pages + Workers

`worker/ask.js` 保留了 Cloudflare Worker 版代理（SSE 流式，前端同样兼容），部署方式见 `worker/README.md`。

### 备选：GitHub Pages（无 AI）

1. `vite.config.ts` 把 `base` 改为 `'/<仓库名>/'`，重新 build
2. 把 `dist/` 推到 `gh-pages` 分支
3. GitHub Pages 无法运行 `/api/ask`，AI 问答需单独部署 Worker 并把 `src/lib/ai.ts` 的 `ASK_ENDPOINT` 改为完整 URL（CORS 已放行）

## 配置 AI 问答

代理代码在 `api/ask.js`（Vercel 方案，默认）。环境变量见上表。机制：

- 前端提问前先在本地检索 top 8 相关经文，随问题一起 POST 到 `/api/ask`
- 代理拼接系统指令（只依据经文与公有领域注解回答、标注出处、争议话题中立、末尾固定免责语）后调用大模型
- 回答以非流式 JSON 返回（稳妥优先；前端同时兼容 SSE 流，换 Cloudflare Worker 版代理可无缝切换）
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

## 注解数据格式（预留）

文件：`public/data/commentary/{bookId}.json`（没有该文件的卷显示「整理中」）

```jsonc
{ "bookId": "mat", "source": "马太亨利圣经注释（公有领域）",
  "chapters": [ { "chapter": 5, "sections": [ { "verses": "1-12", "text": "……" } ] } ] }
```

只收录版权已过期的原著与确认公有领域的中译本；V1 优先：新约 + 诗篇 + 箴言。转换脚本骨架：`scripts/convert-commentary.mjs`。

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
