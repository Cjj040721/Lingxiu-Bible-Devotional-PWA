# LEDGER.md — 灵修伴读项目台账

> 一事一记。DONE 记已完成,NEXT 记待办。新记录追加在各自区块顶部。

## 当前状态(2026-07-31)

- V1 功能完整，生产环境托管于 Cloudflare Workers（lingxiubible.top；Vercel 方案已弃用）
- 圣经数据:66 卷 / 1189 章 / 31100 节,`validate:bible` 全通过
- 逐节注解:**全本 66 卷**(CAO-20 扩充旧约 37 卷完成;逐节简注 31032 条,与圣经条目一一对应 + 4050 段 MHCC 节段中译)
- 平台侧:Multica 项目「灵修伴读」已启动,小队 = 主理人 + 前端工程师

## DONE

- 2026-11-18 · CAO-21 GitHub 作品集展示改造：新增英文主页、保留详细中文文档、制作首页/阅读/计划/AI 真实截图与组合首图；通过 `.gitattributes` 排除原始资料和数据对语言统计的干扰；未改生产配置、未部署 · `25919f2`
- 2026-07-31 · CAO-20 旧约 37 卷注解扩充执行完成(owner 拍板「直接启动」):源数据 12 处修复(王下补 ch1、摩 1 整章兜底、10 章 KJV/和合本节号口径改标,均对照 CCEL)→ 管道扩到 66 卷 → 节段中译 4050 段 → 逐节简注全本 31032 条(与圣经条目一一对应:缺 0 多 0,OT 48 条 + V1 存量 18 条合节拆分/重复已清洗;长度达标 97.1%;抽样 12 条人工读通过);translate 脚本补「数量不符重试+拆半递归」健壮性;build 通过(PWA 预缓存 10MB→17.8MB)、lint 零 error、validate:commentary 双目录 132 项全过 · `ccff4d0` `1a6b4c7` `47dcb66` `e869f77`
- 2026-07-31 · CAO-20 旧约注解扩充评估:方案已贴 issue 评论。结论:MHCC 旧约 37 卷 748 章全覆盖、双源版权干净;源数据瑕疵 12 处(王下缺 ch1 文件、摩 1 无节段标题、10 章节号口径异常,均可对照 CCEL 修复);成本 ≈$2.4/¥20 内、1-2 工作日;建议三批执行(批 1:创/出/伯/赛/但)。评估只读统计、未调 API、零费用,是否执行待 owner 拍板
- 2026-07-31 · 文档定版:部署方案只留 Cloudflare(lingxiubible.top),README 部署章节重写、AGENTS.md 边界条目同步;Vercel 方案标记弃用(`vercel.json`/`api/ask.js` 仅存档);owner 确认自用阶段不启用 PASSCODE · 见本次 docs commit
- 2026-07-31 · CAO-19 试用前自查:build 通过 + validate:bible 36 项全过;Cloudflare 生产(lingxiubible.top)静态资源/SPA 回退/AI 问答流式全链路 200;发现:① `*.vercel.app` 国内不可达,试用链接须用自有域名 ② Worker 未配置 `PASSCODE`,AI 问答暂无口令保护(是否配置由 owner 决定)
- 2026-07-31 · 仓库补三件套之 AGENTS.md + LEDGER.md,`.gitignore` 补 `.wrangler`(docs commit,见 git log)
- 2026-07-31 · 补推尾部 8 卷加深版逐节注解(希伯来书~犹大书,736 条,中位 107 字)——上次推送时重生成未跑完;证据:validate:bible 36 项通过、validate:commentary 58 项通过 · `a140515`
- 2026-07-30 · 逐节注解改「点节看注」交互 + 全量重生成加深版(11334 条) · `b055764`
- 2026-07-30 · V1 全功能完成并部署 Vercel 上线(阅读/金句/计划打卡/搜索/笔记书签/金句卡片/AI 问答/注解/PWA 离线)

## NEXT

- 小圈子试用:发放链接与圈子口令(口令由 owner 本人发放),收集第一批反馈
- 试用反馈分类后建 issue 排期
- 旧约注解扩充:已完成(2026-07-31,66 卷全覆盖,见 DONE 区 CAO-20 执行记录);生产部署(wrangler deploy)归 owner
- 候选:`AGENTS.md` 规范在 Multica 小队 instructions 同步(已同步,2026-07-31)
