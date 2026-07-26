/**
 * 注解数据转换脚本（MHCC 英文原文 → 结构化英文 JSON）
 *
 * 输入: scripts/raw/mhcc/src/（lyteword/mhenry-concise 仓库的 Markdown，CC0-1.0）
 *   来源: https://github.com/lyteword/mhenry-concise
 *   内容为马太亨利简明圣经注释（Matthew Henry's Concise Commentary, 1706 年原著，公有领域）
 *   每章一个文件：{书卷目录}/chapter-{n}.md，诗篇为 psalms/psalm-{n}.md
 *   章内用「## Verses 3–12」/「## Verse 5」/「## Verses 12, 13」标题切分节段
 *
 * 输出: scripts/raw/commentary-en/{bookId}.json（格式同前端约定，供翻译脚本读取）
 * {
 *   "bookId": "mat",
 *   "source": "Matthew Henry's Concise Commentary ... (public domain)",
 *   "chapters": [ { "chapter": 5, "sections": [ { "verses": "1-12", "text": "……" } ] } ]
 * }
 *
 * 范围: V1 = 新约 27 卷 + 诗篇 + 箴言（29 卷 441 章）
 * 校验: 与 public/data/bible/books/ 的节数交叉核对（首段从 1 开始、末段到该章末节、段间无断档）
 * 运行: node scripts/convert-commentary.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, 'raw', 'mhcc', 'src');
const OUT_DIR = path.join(__dirname, 'raw', 'commentary-en');
const BIBLE_DIR = path.join(__dirname, '..', 'public', 'data', 'bible', 'books');

/** V1 范围 29 卷 → 仓库中的书卷目录名 */
const BOOK_DIR = {
  mat: 'matthew', mar: 'mark', luk: 'luke', joh: 'john', act: 'acts',
  rom: 'romans', '1co': '1-corinthians', '2co': '2-corinthians', gal: 'galatians',
  eph: 'ephesians', phi: 'philippians', col: 'colossians',
  '1th': '1-thessalonians', '2th': '2-thessalonians',
  '1ti': '1-timothy', '2ti': '2-timothy', tit: 'titus', phm: 'philemon',
  heb: 'hebrews', jam: 'james', '1pe': '1-peter', '2pe': '2-peter',
  '1jo': '1-john', '2jo': '2-john', '3jo': '3-john', jud: 'jude', rev: 'revelation',
  psa: 'psalms', pro: 'proverbs',
};

const V1_BOOKS = BOOKS_META.filter((b) => BOOK_DIR[b.bookId]);

/**
 * 数据修复（已与 CCEL 版 MHCC 全文 ThML https://ccel.org/ccel/henry/mhcc 逐处核对）：
 * 这些「缺段」并非内容丢失，而是 CCEL/Logos 版 MHCC 把相邻节的注解合写在同一段里、
 * 只是标题没拆开；另有两处 KJV 与和合本节号口径差异。这里按内容实际覆盖范围改标 verses。
 * 格式：{ bookId: { 章: { 原标题: 新标题 } } }；textFix 用于清理标题残留进正文的字符。
 */
const RELABEL = {
  mat: { 13: { '24-30': '24-43' } }, // 原标题「Verses 24–30, 36–43」，格式不支持双区间，合并标注
  joh: { 3: { '1-8': '1-21' }, 7: { '40-53': '40-52' } }, // 3 章 9-21 注解合写在 1-8 段内；7:53 并入和合本 8:1
  psa: { 116: { '10-19': '10-18' }, 150: { '1-5': '1-6' } }, // 116 篇 KJV 19 节 vs 和合本 18 节（末节合并）；150 篇注解覆盖全篇
  pro: { 14: { 12: '12-13' }, 16: { 9: '9-10', 19: '19-20' }, 22: { 28: '28-29' } },
  '3jo': { 1: { '13-14': '13-15' } },
};
/** 正文清理：mat 13 的 24-30 段开头残留了标题残片「, 36–43 」 */
const TEXT_FIX = {
  mat: { 13: { '24-30': (t) => t.replace(/^[,\s]*\d+–\d+\s+/, '') } },
};

/** 章文件名：诗篇是 psalm-N.md，其余是 chapter-N.md */
function chapterFile(dir, bookId, chapter) {
  const name = bookId === 'psa' ? `psalm-${chapter}.md` : `chapter-${chapter}.md`;
  return path.join(SRC_DIR, dir, name);
}

/**
 * 解析单章 Markdown → sections
 * 只收「## Verse/Verses/Chapter <数字>」标题下的正文；
 * 「## Chapter/Psalm Outline」（章大纲）与其他标题的内容跳过。
 * 逗号写法「Verses 12, 13」在源数据中均为相邻两节，合并为区间 "12-13"。
 * 已知源数据瑕疵：psalms/psalm-123.md 的标题误作「## Chapter 1-4」，按节段解析兼容。
 */
function parseChapterMarkdown(md, label) {
  const sections = [];
  let current = null; // { verses, lines[] }
  let skip = false;

  for (const line of md.split(/\r?\n/)) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      const title = heading[1].trim();
      if (/^(Chapter|Psalm) Outline/.test(title)) {
        skip = true;
        current = null;
        continue;
      }
      const verseHead = title.match(/^(?:Verses?|Chapter)\s+(.+)$/);
      if (verseHead) {
        const nums = (verseHead[1].match(/\d+/g) ?? []).map(Number);
        if (!nums.length) throw new Error(`${label} 标题无法解析节号: "## ${title}"`);
        const lo = Math.min(...nums);
        const hi = Math.max(...nums);
        current = { verses: lo === hi ? String(lo) : `${lo}-${hi}`, lines: [] };
        sections.push(current);
        skip = false;
        continue;
      }
      // 其他二级标题：忽略其下内容
      skip = true;
      current = null;
      continue;
    }
    if (current && !skip) current.lines.push(line);
  }

  return sections
    .map((s) => ({
      verses: s.verses,
      text: s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    }))
    .filter((s) => s.text);
}

/** 读取和合本数据中某章的最大节号（用于交叉核对注解覆盖范围） */
function bibleMaxVerse(bookId, chapter) {
  const file = path.join(BIBLE_DIR, `${bookId}.json`);
  if (!fs.existsSync(file)) return null;
  const book = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ch = book.chapters[chapter - 1];
  if (!ch) return null;
  const last = ch.verses[ch.verses.length - 1];
  return last.end ?? last.v;
}

if (!fs.existsSync(SRC_DIR)) {
  console.error(`缺少原文目录: ${SRC_DIR}`);
  console.error('请先下载: git clone https://github.com/lyteword/mhenry-concise scripts/raw/mhcc/src');
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const SOURCE_EN =
  "Matthew Henry's Concise Commentary on the Whole Bible (1706, public domain) · text: github.com/lyteword/mhenry-concise (CC0-1.0)";

let totalSections = 0;
let totalBytes = 0;
let warnings = 0;

for (const meta of V1_BOOKS) {
  const dir = BOOK_DIR[meta.bookId];
  const chapters = [];

  for (let ch = 1; ch <= meta.chapters; ch++) {
    const file = chapterFile(dir, meta.bookId, ch);
    if (!fs.existsSync(file)) throw new Error(`${meta.name} 缺少章文件: ${path.relative(process.cwd(), file)}`);
    const sections = parseChapterMarkdown(fs.readFileSync(file, 'utf8'), `${meta.bookId} ${ch}`);
    if (!sections.length) throw new Error(`${meta.name} 第${ch}章 解析不到任何节段`);

    // 应用修复表（改标 verses / 清理正文残留）
    for (const s of sections) {
      const fix = TEXT_FIX[meta.bookId]?.[ch]?.[s.verses];
      if (fix) s.text = fix(s.text);
      const newLabel = RELABEL[meta.bookId]?.[ch]?.[s.verses];
      if (newLabel) {
        console.log(`  🔧 修复 ${meta.name} 第${ch}章: 段 ${s.verses} 改标为 ${newLabel}`);
        s.verses = newLabel;
      }
    }

    // 与和合本节数交叉核对：首段从 1 开始、段间无缺口（相邻段重叠属原书分段的正常情况，如 诗95 1-7/7-11）
    let cursor = 1;
    for (const s of sections) {
      const m = s.verses.match(/^(\d+)(?:-(\d+))?$/);
      const lo = Number(m[1]);
      const hi = Number(m[2] ?? m[1]);
      if (lo > cursor) {
        console.log(`  ⚠ ${meta.name} 第${ch}章 节段缺口: ${cursor}-${lo - 1} 无注解覆盖`);
        warnings++;
      }
      cursor = Math.max(cursor, hi + 1);
    }
    const maxVerse = bibleMaxVerse(meta.bookId, ch);
    if (maxVerse != null && cursor - 1 !== maxVerse) {
      console.log(`  ⚠ ${meta.name} 第${ch}章 末段到${cursor - 1}节，该章共${maxVerse}节`);
      warnings++;
    }
    chapters.push({ chapter: ch, sections });
  }

  const bookData = { bookId: meta.bookId, source: SOURCE_EN, chapters };
  const json = JSON.stringify(bookData);
  fs.writeFileSync(path.join(OUT_DIR, `${meta.bookId}.json`), json);

  const sections = chapters.reduce((s, c) => s + c.sections.length, 0);
  totalSections += sections;
  totalBytes += Buffer.byteLength(json);
  console.log(
    `  ✓ ${meta.name.padEnd(6, '　')} ${meta.chapters}章 ${String(sections).padStart(4)}段 ${(Buffer.byteLength(json) / 1024).toFixed(0).padStart(4)}KB`,
  );
}

console.log(`\n✓ 转换完成: ${V1_BOOKS.length}卷 / ${totalSections}段 / ${(totalBytes / 1024 / 1024).toFixed(2)}MB（英文中间数据）`);
console.log(`✓ 输出: ${path.relative(process.cwd(), OUT_DIR)}`);
if (warnings) console.log(`⚠ 覆盖核对警告 ${warnings} 处（见上方日志，末段节号差异多为源数据分段口径不同）`);
