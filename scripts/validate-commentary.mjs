/**
 * 注解数据校验脚本
 * 校验目录下 {bookId}.json（默认 scripts/raw/commentary-en，英文中间数据；
 * 翻译产物用 node scripts/validate-commentary.mjs public/data/commentary）
 *
 * 校验项：
 *  1. 章号 1..该卷标准章数连续（对照 books-meta.mjs）
 *  2. verses 格式合法（^\d+(-\d+)?$，区间上限≥下限），章内按起始节号递增
 *  3. text 非空
 *  4. 单文件 < 500KB（前端按需加载/PWA 预缓存约定）
 *  5. 统计每卷 sections 总数
 *
 * 运行: node scripts/validate-commentary.mjs [目录]   退出码: 全部通过=0，任一失败=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.argv[2]
  ? path.resolve(process.argv[2]) // 相对路径基于当前工作目录
  : path.join(__dirname, 'raw', 'commentary-en');
const MAX_FILE_BYTES = 500 * 1024;

const V1_BOOKS = BOOKS_META.filter((b) => b.testament === 'new' || b.bookId === 'psa' || b.bookId === 'pro');
const VERSES_RE = /^\d+(-\d+)?$/;

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(label + (detail ? ` (${detail})` : ''));
    console.log(`  ✗ ${label}${detail ? '  ' + detail : ''}`);
  }
}

console.log('========== 注解数据校验 ==========');
console.log(`目录: ${path.relative(process.cwd(), DATA_DIR)}\n`);

if (!fs.existsSync(DATA_DIR)) {
  console.error(`目录不存在: ${DATA_DIR}`);
  process.exit(1);
}

let totalSections = 0;
let totalBytes = 0;
let covered = 0;

for (const meta of V1_BOOKS) {
  const file = path.join(DATA_DIR, `${meta.bookId}.json`);
  if (!fs.existsSync(file)) {
    console.log(`  - ${meta.name} 缺文件（跳过，未覆盖）`);
    continue;
  }
  covered++;
  const bytes = fs.statSync(file).size;
  totalBytes += bytes;
  const problems = [];

  let book;
  try {
    book = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    check(`${meta.name} JSON 解析`, false, err.message);
    continue;
  }

  if (book.bookId !== meta.bookId) problems.push(`bookId=${book.bookId}`);
  if (typeof book.source !== 'string' || !book.source.trim()) problems.push('source 为空');
  if (!Array.isArray(book.chapters)) problems.push('chapters 非数组');
  if (book.chapters?.length !== meta.chapters) problems.push(`章数=${book.chapters?.length}(应为${meta.chapters})`);

  let bookSections = 0;
  book.chapters?.forEach((c, i) => {
    if (c.chapter !== i + 1) problems.push(`章号断档@${c.chapter}`);
    if (!Array.isArray(c.sections) || !c.sections.length) problems.push(`第${c.chapter}章无节段`);
    let prevLo = 0;
    for (const s of c.sections ?? []) {
      bookSections++;
      if (!VERSES_RE.test(s.verses ?? '')) {
        problems.push(`非法verses@${c.chapter}:"${s.verses}"`);
        continue;
      }
      const [lo, hi] = s.verses.split('-').map(Number);
      if (hi !== undefined && hi < lo) problems.push(`区间倒置@${c.chapter}:${s.verses}`);
      if (lo <= prevLo) problems.push(`节段未递增@${c.chapter}:${s.verses}`);
      prevLo = lo;
      if (typeof s.text !== 'string' || !s.text.trim()) problems.push(`空text@${c.chapter}:${s.verses}`);
    }
  });

  totalSections += bookSections;
  check(`${meta.name} 结构校验`, problems.length === 0, problems.slice(0, 3).join('; '));
  check(`${meta.name} 文件 < 500KB`, bytes < MAX_FILE_BYTES, `${(bytes / 1024).toFixed(0)}KB`);
  if (problems.length === 0) {
    console.log(
      `  ✓ ${String(meta.order).padStart(2)} ${meta.name.padEnd(6, '　')} ${book.chapters.length}章 ${String(bookSections).padStart(4)}段 ${(bytes / 1024).toFixed(0).padStart(4)}KB`,
    );
  }
}

console.log('\n================================================');
console.log(`覆盖: ${covered}/${V1_BOOKS.length}卷  总节段: ${totalSections}  总大小: ${(totalBytes / 1024 / 1024).toFixed(2)}MB`);
console.log(`结果: ${passed} 项通过, ${failed} 项失败`);
if (failed) {
  console.log('失败项:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
}
console.log('✓ 注解数据校验通过');
