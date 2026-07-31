# LEDGER.md — 灵修伴读项目台账

> 一事一记。DONE 记已完成,NEXT 记待办。新记录追加在各自区块顶部。

## 当前状态(2026-07-31)

- V1 功能完整并已上线 Vercel(`OPENAI_API_KEY` 已配置,AI 问答可用)
- 圣经数据:66 卷 / 1189 章 / 31100 节,`validate:bible` 全通过
- 逐节注解:新约 27 卷 + 诗篇 + 箴言,加深版(含义/见解/应用,中位约 104-107 字)已全量入库
- 平台侧:Multica 项目「灵修伴读」已启动,小队 = 主理人 + 前端工程师

## DONE

- 2026-07-31 · 文档定版:部署方案只留 Cloudflare(lingxiubible.top),README 部署章节重写、AGENTS.md 边界条目同步;Vercel 方案标记弃用(`vercel.json`/`api/ask.js` 仅存档);owner 确认自用阶段不启用 PASSCODE · 见本次 docs commit
- 2026-07-31 · CAO-19 试用前自查:build 通过 + validate:bible 36 项全过;Cloudflare 生产(lingxiubible.top)静态资源/SPA 回退/AI 问答流式全链路 200;发现:① `*.vercel.app` 国内不可达,试用链接须用自有域名 ② Worker 未配置 `PASSCODE`,AI 问答暂无口令保护(是否配置由 owner 决定)
- 2026-07-31 · 仓库补三件套之 AGENTS.md + LEDGER.md,`.gitignore` 补 `.wrangler`(docs commit,见 git log)
- 2026-07-31 · 补推尾部 8 卷加深版逐节注解(希伯来书~犹大书,736 条,中位 107 字)——上次推送时重生成未跑完;证据:validate:bible 36 项通过、validate:commentary 58 项通过 · `a140515`
- 2026-07-30 · 逐节注解改「点节看注」交互 + 全量重生成加深版(11334 条) · `b055764`
- 2026-07-30 · V1 全功能完成并部署 Vercel 上线(阅读/金句/计划打卡/搜索/笔记书签/金句卡片/AI 问答/注解/PWA 离线)

## NEXT

- 小圈子试用:发放链接与圈子口令(口令由 owner 本人发放),收集第一批反馈
- 试用反馈分类后建 issue 排期
- 候选:旧约书卷注解扩充评估(数据源、API 成本、工作量,先出方案再定)
- 候选:`AGENTS.md` 规范在 Multica 小队 instructions 同步(已同步,2026-07-31)
