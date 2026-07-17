/**
 * 和合本（简体）数据转换脚本 v2
 * 输入: scripts/raw/xucz1109_bible_zh_cuvs.json
 *   （源: https://github.com/xucz1109/bible-zh-cuvs，上游 https://github.com/haitai/bible；
 *     与 wordproject.org 简体和合本逐章交叉验证过）
 * 输出: public/data/bible/index.json + public/data/bible/books/{bookId}.json
 *
 * 关于「合节」：和合本印刷版存在多节合并（如 诗8:6-8、民1:20-21、弗6:2-3），
 * 本格式用 { v: 起始节, end: 结束节, t: 文本 } 表示；普通节为 { v, t }。
 *
 * 修复说明：源数据仅 约书亚记3章 丢失 10-11 合节文字（已与 wordproject.org 核对补回）。
 * 运行: node scripts/convert-bible.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_FILE = path.join(__dirname, 'raw', 'xucz1109_bible_zh_cuvs.json');
const OUT_DIR = path.join(__dirname, '..', 'public', 'data', 'bible');
const BOOKS_DIR = path.join(OUT_DIR, 'books');

/** 数据修复：书卷ID → 章 → 需要插入的合节条目（按 v 排序插入） */
const REPAIRS = {
  jos: {
    3: [
      {
        v: 10,
        end: 11,
        t: '约书亚说，看哪，普天下主的约柜必在你们前头过去，到约旦河里，因此你们就知道在你们中间有永生神。并且他必在你们面前赶出迦南人，赫人，希未人，比利洗人，革迦撒人，亚摩利人，耶布斯人。',
        note: '源数据丢失此合节，依 wordproject.org 简体和合本补回',
      },
    ],
  },
};

const raw = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
const srcBooks = raw.books;
if (!Array.isArray(srcBooks) || srcBooks.length !== 66) {
  throw new Error(`源数据卷数异常: ${srcBooks?.length}`);
}

fs.rmSync(BOOKS_DIR, { recursive: true, force: true });
fs.mkdirSync(BOOKS_DIR, { recursive: true });

const indexBooks = [];
let totalChapters = 0;
let totalVerseSlots = 0; // 可寻址节位（每章最大节号之和）
let totalEntries = 0; // 实际条目数（合节算一条）

for (const meta of BOOKS_META) {
  const src = srcBooks.find((b) => b.bookIndex === meta.order);
  if (!src) throw new Error(`源数据缺少第 ${meta.order} 卷（${meta.name}）`);
  if (src.name !== meta.name) console.log(`  ⚠ 卷名差异 order=${meta.order}: 源="${src.name}" 采用="${meta.name}"`);

  const chapters = src.chapters.map((c, i) => {
    if (c.chapter !== i + 1) throw new Error(`${meta.name} 章号不连续: ${c.chapter}`);
    // 1) 原始节列表 + 并入修复条目（修复条目自带显式区间）
    const rawVerses = c.verses.map((v) => ({ v: v.verse, t: String(v.text).trim() }));
    const repairs = REPAIRS[meta.bookId]?.[c.chapter] ?? [];
    for (const r of repairs) {
      if (rawVerses.some((e) => e.v === r.v)) {
        throw new Error(`${meta.name}${c.chapter}章 修复条目 ${r.v} 与现有条目冲突`);
      }
      rawVerses.push({ v: r.v, end: r.end, t: r.t, repaired: true });
      rawVerses.sort((a, b) => a.v - b.v);
      console.log(`  🔧 修复 ${meta.name}${c.chapter}章: 补入 ${r.v}-${r.end} 合节`);
    }
    // 2) 推导区间：显式 end 优先；否则与下一条跳号则为合节
    const entries = rawVerses.map((cur, k) => {
      const next = rawVerses[k + 1];
      const entry = { v: cur.v, t: cur.t };
      if (cur.end) entry.end = cur.end;
      else if (next && next.v - cur.v > 1) entry.end = next.v - 1;
      return entry;
    });
    // 3) 区间完整性校验：条目必须无缝拼接 1..maxVerse
    let cursor = 1;
    for (const e of entries) {
      if (e.v !== cursor) throw new Error(`${meta.name}${c.chapter}章 节区间断档: 期望${cursor} 实际${e.v}`);
      if (!e.t) throw new Error(`${meta.name}${c.chapter}章 ${e.v}节 文本为空`);
      cursor = (e.end ?? e.v) + 1;
    }
    return { chapter: c.chapter, verses: entries };
  });

  const chapterSlots = chapters.map((c) => {
    const last = c.verses[c.verses.length - 1];
    return last.end ?? last.v;
  });
  const bookSlots = chapterSlots.reduce((s, n) => s + n, 0);
  const bookEntries = chapters.reduce((s, c) => s + c.verses.length, 0);
  totalChapters += chapters.length;
  totalVerseSlots += bookSlots;
  totalEntries += bookEntries;

  const bookData = {
    bookId: meta.bookId,
    name: meta.name,
    abbr: meta.abbr,
    testament: meta.testament,
    order: meta.order,
    chapters,
  };
  fs.writeFileSync(path.join(BOOKS_DIR, `${meta.bookId}.json`), JSON.stringify(bookData));

  indexBooks.push({
    bookId: meta.bookId,
    name: meta.name,
    abbr: meta.abbr,
    testament: meta.testament,
    order: meta.order,
    chapters: chapters.length,
    verses: bookSlots,
  });
}

const indexData = {
  version: 'cuvs',
  versionName: '中文和合本（简体）',
  source: 'https://github.com/xucz1109/bible-zh-cuvs（上游 haitai/bible；与 wordproject.org 交叉验证）',
  license: '公有领域（和合本，1919）',
  generatedAt: new Date().toISOString(),
  totalBooks: indexBooks.length,
  totalChapters,
  totalVerses: totalVerseSlots,
  totalEntries,
  books: indexBooks,
};
fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(indexData));

console.log(`✓ 转换完成: ${indexBooks.length}卷 / ${totalChapters}章 / ${totalVerseSlots}节位 / ${totalEntries}条目`);
console.log(`✓ 输出: ${path.relative(process.cwd(), OUT_DIR)}`);
