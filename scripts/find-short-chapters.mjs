/**
 * 扫描 xucz 相对 thiago 短超过阈值的所有章节（丢文嫌疑清单）
 * 用法: node scripts/find-short-chapters.mjs [阈值=8]
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
const threshold = parseInt(process.argv[2] || '8', 10);

const rows = [];
const rowsRev = [];
for (let i = 0; i < 66; i++) {
  const xb = x.books[i];
  const tb = t[i];
  for (let c = 0; c < xb.chapters.length; c++) {
    const xl = norm(xb.chapters[c].verses.map((v) => v.text).join('')).length;
    const tl = norm((tb.chapters[c] || []).join('')).length;
    if (tl - xl > threshold) rows.push({ label: `${xb.name}${c + 1}章`, d: tl - xl });
    if (xl - tl > threshold) rowsRev.push({ label: `${xb.name}${c + 1}章`, d: xl - tl });
  }
}
rows.sort((a, b) => b.d - a.d);
console.log(`xucz 比 thiago 短 >${threshold} 字的章节数: ${rows.length}`);
rows.forEach((r) => console.log(`  Δ=${r.d}\t${r.label}`));
rowsRev.sort((a, b) => b.d - a.d);
console.log(`xucz 比 thiago 长 >${threshold} 字的章节数: ${rowsRev.length}`);
rowsRev.forEach((r) => console.log(`  Δ=+${r.d}\t${r.label}`));
