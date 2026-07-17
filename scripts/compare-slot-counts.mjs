/**
 * 对比转换后数据与 thiago 源每章最大节号（应仅 代上21/代上22/约三1 三章不同）
 * 运行: node scripts/compare-slot-counts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'thiagobodruk_zh_cuv.json'), 'utf8').replace(/^﻿/, ''));
const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'bible', 'index.json'), 'utf8'));

let mismatches = [];
for (const meta of idx.books) {
  const book = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'bible', 'books', `${meta.bookId}.json`), 'utf8'));
  const tb = t[meta.order - 1];
  book.chapters.forEach((c, i) => {
    const last = c.verses[c.verses.length - 1];
    const maxV = last.end ?? last.v;
    const tN = tb.chapters[i].length;
    if (maxV !== tN) mismatches.push(`${meta.name}${c.chapter}章: 转换后max=${maxV} thiago=${tN}`);
  });
}
console.log(`最大节号不一致章节数: ${mismatches.length}`);
mismatches.forEach((m) => console.log('  ' + m));
