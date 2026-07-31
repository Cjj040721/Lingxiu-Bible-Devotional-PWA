# AGENTS.md — 灵修伴读小队工作规范

> 本文件是小队(agent)在本仓库工作的纪律。项目背景与功能说明见 `README.md`,进度台账见 `LEDGER.md`。

## 项目定位(不可偏离)

非盈利、给基督徒小圈子(10-100 人)使用的中文圣经阅读 PWA。

## 合规红线(最高优先,任何任务不得触碰)

- 经文只用公有领域中文和合本(1919),不得引入任何现代版权译本
- 注解只用版权已过期的释经资料(如马太亨利注释),收录新来源前必须核对所用中译本的版权状态
- AI 问答回答固定带「仅供参考,请与牧者交通」免责语
- 不做商业化、不公开推广、不上架应用商店;仅小圈子分享链接使用

## 工程纪律

- **没有证据不算完成**:收工必须在 issue 评论贴 `npm run build` 输出原文;涉及圣经数据(`public/data/bible/`)的改动还必须贴 `npm run validate:bible` 结果(66 卷 / 1189 章 / 31100 节);涉及注解数据贴 `npm run validate:commentary` 结果
- 完成工作后回写 `LEDGER.md`(DONE 追加:日期、事项、commit 号)
- commit 一事一提交,message 用中文带范围前缀,如 `feat(read):` / `fix(plans):` / `data(commentary):`
- 改数据管道(注解生成等)必须说明:数据来源、API 成本、是否支持断点续传
- `.env.local`(含 API Key)永不入库;`node_modules` / `dist` / `.wrangler` 已 gitignore

## 协作纪律

- 活先进 issue,派单或自领都有记录;接手转 in_progress,完成贴证据转 in_review,主理人核验后才转 done
- 需求模糊先澄清(brainstorming)再动手;多步骤任务先写实施计划(writing-plans)再拆子 issue
- 小事主理人自己做,不为派而派

## 边界(必须 owner 本人拍板,agent 只产出方案与草稿)

1. 生产部署/发布(Cloudflare Workers,lingxiubible.top;Vercel 方案已弃用)
2. AI 问答的 `OPENAI_API_KEY` / 圈子口令 `PASSCODE` 配置与额度预算
3. 对小圈子成员的任何对外承诺(上线时间、口令发放等)
