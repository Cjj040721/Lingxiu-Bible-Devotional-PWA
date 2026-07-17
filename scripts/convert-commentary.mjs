/**
 * 注解数据转换脚本（占位/骨架）
 *
 * 目标：把公有领域释经资料（如马太亨利圣经注释中译本、JFB 等）的文本
 * 转换为前端约定的注解格式，输出到 public/data/commentary/{bookId}.json。
 *
 * 输出格式（与 src/lib/commentary.ts 对应）：
 * {
 *   "bookId": "mat",
 *   "source": "马太亨利圣经注释（公有领域）",
 *   "chapters": [
 *     { "chapter": 5, "sections": [ { "verses": "1-12", "text": "……" }, { "verses": "13-16", "text": "……" } ] }
 *   ]
 * }
 *
 * 规则：
 *  - 只使用版权已过期的原著与确认公有领域的中译本
 *  - V1 优先范围：新约 27 卷 + 诗篇 + 箴言
 *  - sections 按经文段切分（一节或连续几节一条），verses 用 "5" 或 "1-12" 表示
 *  - 单卷 JSON 建议 < 500KB，便于按需加载与 PWA 预缓存
 *
 * TODO（下一阶段）：
 *  1. 收集确认版权状态的注解原文（text/markdown）
 *  2. 在此实现：按章节标题切分 → 节范围识别 → 输出上述 JSON
 *  3. 加校验：章节号连续、verses 格式合法、无空 text
 */

console.log('注解转换脚本尚未实现：请先收集公有领域注解原文，再按 scripts/ 内注释的格式约定输出。');
console.log('格式约定见 app/README.md「注解数据格式」一节。');
