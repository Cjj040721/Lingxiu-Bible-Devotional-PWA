/**
 * 圣经数据完整性校验脚本（校验转换后的产物 public/data/bible/）
 * 数据格式：verses 为区间条目 [{v, end?, t}]，合节用 end 表示（如 诗8:6-8）
 * 运行: node scripts/validate-bible.mjs   退出码: 全部通过=0，任一失败=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META, TOTAL_CHAPTERS } from './books-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data', 'bible');

// 黄金总量（转换+修复后经交叉验证确认）
const EXPECTED = { books: 66, chapters: 1189, slots: 31100, entries: 31032 };

let passed = 0;
let failed = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}${detail ? '  ' + detail : ''}`);
  } else {
    failed++;
    failures.push(label + (detail ? ` (${detail})` : ''));
    console.log(`  ✗ ${label}${detail ? '  ' + detail : ''}`);
  }
}

// 关键经文抽检（书卷 章:节 → 必须包含的文字）
const KEY_VERSES = [
  ['gen', 1, 1, '起初', '创世记 1:1'],
  ['gen', 1, 3, '要有光', '创世记 1:3'],
  ['exo', 20, 3, '不可有别的神', '出埃及记 20:3（十诫）'],
  ['deu', 6, 4, '以色列啊', '申命记 6:4'],
  ['jos', 3, 10, '普天下主的约柜', '约书亚记 3:10（修复回补的合节）'],
  ['jos', 3, 11, '普天下主的约柜', '约书亚记 3:11（与 10 节合节）'],
  ['psa', 8, 7, '田野的兽', '诗篇 8:7（合节 6-8 内）'],
  ['psa', 23, 1, '耶和华是我的牧者', '诗篇 23:1'],
  ['psa', 119, 105, '脚前的灯', '诗篇 119:105'],
  ['pro', 3, 5, '专心仰赖耶和华', '箴言 3:5'],
  ['isa', 53, 5, '为我们的过犯受害', '以赛亚书 53:5'],
  ['mal', 4, 6, '父亲的心转向儿女', '玛拉基书 4:6（旧约末尾）'],
  ['mat', 1, 1, '家谱', '马太福音 1:1（新约开头）'],
  ['mat', 5, 3, '虚心的人有福了', '马太福音 5:3（八福）'],
  ['mat', 28, 19, '使万民作我的门徒', '马太福音 28:19（大使命）'],
  ['joh', 1, 1, '太初有道', '约翰福音 1:1'],
  ['joh', 3, 16, '神爱世人', '约翰福音 3:16'],
  ['act', 1, 8, '圣灵降临在你们身上', '使徒行传 1:8'],
  ['rom', 3, 23, '世人都犯了罪', '罗马书 3:23'],
  ['1co', 13, 4, '爱是恒久忍耐', '哥林多前书 13:4'],
  ['eph', 6, 3, '在世长寿', '以弗所书 6:3（合节 2-3 内）'],
  ['phi', 4, 13, '靠着那加给我力量的', '腓立比书 4:13'],
  ['heb', 11, 1, '信就是所望之事的实底', '希伯来书 11:1'],
  ['rev', 21, 4, '不再有死亡', '启示录 21:4'],
  ['rev', 22, 21, '阿们', '启示录 22:21（全圣经末尾）'],
];

/** 在章内查找覆盖第 n 节的条目 */
function findVerse(chapterData, n) {
  const entry = chapterData.verses.find((e) => n >= e.v && n <= (e.end ?? e.v));
  return entry?.t ?? '';
}

console.log('========== 和合本（简体）数据完整性校验 ==========\n');

// 1. 索引文件
console.log('[1] 索引文件');
const indexPath = path.join(DATA_DIR, 'index.json');
check('index.json 存在', fs.existsSync(indexPath));
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
check('卷数 = 66', index.books.length === EXPECTED.books, `实际 ${index.books.length}`);
const otCount = index.books.filter((b) => b.testament === 'old').length;
const ntCount = index.books.filter((b) => b.testament === 'new').length;
check('旧约 39 卷', otCount === 39, `实际 ${otCount}`);
check('新约 27 卷', ntCount === 27, `实际 ${ntCount}`);

// 2. 逐卷校验
console.log('\n[2] 逐卷校验（66 卷 × 章数/区间无缝拼接/非空）');
let totalChapters = 0;
let totalSlots = 0;
let totalEntries = 0;
let booksOk = 0;
const bookDataCache = new Map();
for (const meta of BOOKS_META) {
  const file = path.join(DATA_DIR, 'books', `${meta.bookId}.json`);
  if (!fs.existsSync(file)) {
    check(`${meta.name} 文件缺失`, false);
    continue;
  }
  const book = JSON.parse(fs.readFileSync(file, 'utf8'));
  bookDataCache.set(meta.bookId, book);
  const problems = [];
  if (book.name !== meta.name) problems.push(`卷名=${book.name}`);
  if (book.chapters.length !== meta.chapters) problems.push(`章数=${book.chapters.length}(应为${meta.chapters})`);
  book.chapters.forEach((c, i) => {
    if (c.chapter !== i + 1) problems.push(`章号断档@${c.chapter}`);
    if (!c.verses.length) problems.push(`第${c.chapter}章无经文`);
    // 区间无缝拼接 1..maxVerse
    let cursor = 1;
    for (const e of c.verses) {
      if (e.v !== cursor) problems.push(`节区间断档@${c.chapter}:${cursor}`);
      if (typeof e.t !== 'string' || !e.t.trim()) problems.push(`空节@${c.chapter}:${e.v}`);
      if (e.end !== undefined && e.end <= e.v) problems.push(`非法区间@${c.chapter}:${e.v}-${e.end}`);
      cursor = (e.end ?? e.v) + 1;
    }
  });
  const slots = book.chapters.reduce((s, c) => {
    const last = c.verses[c.verses.length - 1];
    return s + (last.end ?? last.v);
  }, 0);
  const entries = book.chapters.reduce((s, c) => s + c.verses.length, 0);
  totalChapters += book.chapters.length;
  totalSlots += slots;
  totalEntries += entries;
  if (problems.length === 0) {
    booksOk++;
    console.log(`  ✓ ${String(meta.order).padStart(2)} ${meta.name.padEnd(6, '　')} ${book.chapters.length}章 ${slots}节位 ${entries}条目`);
  } else {
    check(`${meta.order} ${meta.name}`, false, problems.slice(0, 3).join('; '));
  }
}
check('66 卷全部通过逐卷校验', booksOk === 66, `${booksOk}/66`);

// 3. 总量校验
console.log('\n[3] 总量校验');
check('总章数 = 1189', totalChapters === TOTAL_CHAPTERS && TOTAL_CHAPTERS === EXPECTED.chapters, `实际 ${totalChapters}`);
check(`总节位 = ${EXPECTED.slots}`, totalSlots === EXPECTED.slots, `实际 ${totalSlots}`);
check(`总条目 = ${EXPECTED.entries}`, totalEntries === EXPECTED.entries, `实际 ${totalEntries}`);
check(
  '索引声明与逐卷统计一致',
  index.totalChapters === totalChapters && index.totalVerses === totalSlots && index.totalEntries === totalEntries,
  `index=${index.totalChapters}/${index.totalVerses}/${index.totalEntries}`,
);

// 4. 关键经文抽检
console.log('\n[4] 关键经文抽检（25 处，含合节内寻址与修复回补）');
for (const [bookId, ch, vs, mustContain, label] of KEY_VERSES) {
  const book = bookDataCache.get(bookId);
  const chapter = book?.chapters[ch - 1];
  const text = chapter ? findVerse(chapter, vs) : '';
  check(label, typeof text === 'string' && text.includes(mustContain), `“${String(text).slice(0, 26)}…”`);
}

// 5. 简体字抽查
console.log('\n[5] 简体字确认');
const allText = BOOKS_META.map((m) => fs.readFileSync(path.join(DATA_DIR, 'books', `${m.bookId}.json`), 'utf8')).join('');
const probeHits = ['愛', '創', '靈', '約', '詩', '馬', '啟', '臺', '體', '爲'].filter((c) => allText.includes(c));
check('全文无典型繁体字', probeHits.length === 0, probeHits.length ? `命中: ${probeHits.join(' ')}` : '');
check('含简体标志字「爱/灵/诗/约」', ['爱', '灵', '诗', '约'].every((c) => allText.includes(c)));

console.log('\n================================================');
console.log(`结果: ${passed} 项通过, ${failed} 项失败`);
if (failed) {
  console.log('失败项:');
  failures.forEach((f) => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log(`✓ 全部校验通过：66 卷 / ${EXPECTED.chapters} 章 / ${EXPECTED.slots} 节位 / ${EXPECTED.entries} 条目，简体和合本数据完整可用`);
}
