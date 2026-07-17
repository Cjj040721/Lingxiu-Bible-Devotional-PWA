/**
 * 逐节对照指定章节在两个数据源中的差异（调试用）
 * 用法: node scripts/diff-chapter.mjs 约书亚记 3
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Converter } from 'opencc-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const x = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'xucz1109_bible_zh_cuvs.json'), 'utf8'));
const t = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw', 'thiagobodruk_zh_cuv.json'), 'utf8').replace(/^﻿/, ''));
const t2s = Converter({ from: 'tw', to: 'cn' });
const norm = (s) => t2s(s).replace(/[她它]/g, '他').replace(/[^一-鿿0-9A-Za-z]/g, '');

const [bookName, chStr] = process.argv.slice(2);
const ci = parseInt(chStr, 10) - 1;
const bi = x.books.findIndex((b) => b.name === bookName);
const xb = x.books[bi];
const tb = t[bi];
const xv = xb.chapters[ci].verses;
const tv = tb.chapters[ci];
console.log(`===== ${bookName}${ci + 1}章 (xucz ${xv.length}条, thiago ${tv.length}节) =====`);
const max = Math.max(xv.length, tv.length);
for (let k = 0; k < max; k++) {
  const a = xv[k] ? `(${xv[k].verse}) ${xv[k].text}` : '(无)';
  const b = tv[k] ? t2s(tv[k].replace(/\s+/g, '')) : '(无)';
  if (norm(xv[k]?.text || '') !== norm(tv[k] || '')) {
    console.log(`--- 条目 ${k + 1}:`);
    console.log('  x: ' + a);
    console.log('  t: ' + b);
  }
}
