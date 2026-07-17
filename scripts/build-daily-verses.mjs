/**
 * 每日金句生成脚本：从转换后的圣经数据中按引用清单抽取经文，
 * 保证金句文字与圣经数据完全一致。
 * 输出: src/data/daily-verses.json
 * 运行: node scripts/build-daily-verses.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = path.join(__dirname, '..', 'public', 'data', 'bible', 'books');
const OUT = path.join(__dirname, '..', 'src', 'data', 'daily-verses.json');

// [bookId, chapter, 起始节, 结束节(可选)] —— 精选 42 节，按日期轮换
const REFS = [
  ['gen', 1, 1], ['gen', 1, 27], ['gen', 28, 15], ['exo', 20, 12], ['exo', 33, 14],
  ['num', 6, 24, 26], ['deu', 6, 5], ['deu', 31, 6], ['jos', 1, 9], ['rut', 1, 16],
  ['1sa', 16, 7], ['2sa', 22, 31], ['1ch', 16, 11], ['job', 19, 25], ['job', 42, 2],
  ['psa', 16, 11], ['psa', 19, 1], ['psa', 23, 1], ['psa', 27, 1], ['psa', 34, 8],
  ['psa', 37, 4], ['psa', 46, 1], ['psa', 46, 10], ['psa', 55, 22], ['psa', 90, 12],
  ['psa', 103, 1], ['psa', 118, 24], ['psa', 119, 105], ['psa', 121, 1, 2], ['psa', 139, 13, 14],
  ['pro', 3, 5, 6], ['pro', 16, 3], ['ecc', 3, 1], ['isa', 40, 31], ['isa', 41, 10],
  ['jer', 29, 11], ['lam', 3, 22, 23], ['dan', 3, 17], ['mic', 6, 8], ['mat', 5, 3],
  ['mat', 6, 33], ['mat', 11, 28], ['mat', 28, 20], ['mar', 10, 45], ['luk', 1, 37],
  ['joh', 1, 1], ['joh', 3, 16], ['joh', 8, 12], ['joh', 14, 6], ['joh', 14, 27],
  ['act', 1, 8], ['rom', 5, 8], ['rom', 8, 28], ['rom', 12, 2], ['1co', 13, 4],
  ['1co', 13, 13], ['gal', 5, 22, 23], ['eph', 2, 8], ['phi', 4, 6, 7], ['phi', 4, 13],
  ['col', 3, 23], ['1th', 5, 16, 18], ['heb', 11, 1], ['heb', 13, 8], ['jam', 1, 5],
  ['1pe', 5, 7], ['1jo', 4, 8], ['rev', 21, 4], ['rev', 22, 20],
];

const verses = REFS.map(([bookId, ch, v, end]) => {
  const book = JSON.parse(fs.readFileSync(path.join(BOOKS_DIR, `${bookId}.json`), 'utf8'));
  const chapter = book.chapters[ch - 1];
  if (!chapter) throw new Error(`${bookId} ${ch} 不存在`);
  const lo = v;
  const hi = end ?? v;
  const texts = [];
  for (const entry of chapter.verses) {
    const eLo = entry.v;
    const eHi = entry.end ?? entry.v;
    if (eHi >= lo && eLo <= hi) texts.push(entry.t);
  }
  if (!texts.length) throw new Error(`${bookId} ${ch}:${v} 未找到`);
  const ref = `${book.name} ${ch}:${end ? `${v}-${end}` : v}`;
  return { bookId, chapter: ch, v, end: end ?? null, ref, text: texts.join('') };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ verses }, null, 2));
console.log(`✓ 生成 ${verses.length} 条每日金句 → ${path.relative(process.cwd(), OUT)}`);
