/**
 * 注解译文英文书卷引用修复脚本
 * 扫描 public/data/commentary/*.json 所有 sections.text，
 * 把残留的英文书卷引用（如 "Joh 15:3, 4"、"2Sa 7:12; Ps 89:3等"）
 * 替换为中文简称（"约 15:3, 4"、"撒下 7:12; 诗 89:3等"），章节数字与分隔符原样保留。
 *
 * 替换逻辑见 scripts/lib/commentary-refs.mjs（translate-commentary.mjs 共用）。
 *
 * 运行:
 *   node scripts/fix-commentary-refs.mjs           # dry-run：只打印统计与无法识别样本
 *   node scripts/fix-commentary-refs.mjs --write   # 落盘，并同步更新 scripts/raw/commentary-zh-cache/
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';
import { replaceEnglishRefs, findUnrecognizedRefs } from './lib/commentary-refs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(APP_DIR, 'public', 'data', 'commentary');
const CACHE_DIR = path.join(__dirname, 'raw', 'commentary-zh-cache');

const WRITE = process.argv.includes('--write');

/** 上下文截取长度（无法识别样本前后各取 20 字） */
const CTX = 20;

const metaById = Object.fromEntries(BOOKS_META.map((b) => [b.bookId, b]));

/** 对一段文本做替换并累计统计，返回新文本 */
function fixText(text, perBookCount) {
  return replaceEnglishRefs(text, (bookId) => {
    perBookCount.set(bookId, (perBookCount.get(bookId) ?? 0) + 1);
  });
}

/** 汇总 perBookCount 到 totalCount */
function mergeInto(total, part) {
  for (const [k, v] of part) total.set(k, (total.get(k) ?? 0) + v);
}

function fmtCounts(countMap) {
  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${metaById[id]?.abbr ?? id}×${n}`)
    .join(' ');
}

function main() {
  console.log('========== 注解英文书卷引用修复 ==========');
  console.log(`模式: ${WRITE ? '--write（落盘）' : 'dry-run（不写盘，加 --write 应用）'}\n`);

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort();
  const grandCount = new Map();
  let grandTotal = 0;
  let changedFiles = 0;
  const unrecognized = []; // { file, where, match, context }

  for (const file of files) {
    const bookId = path.basename(file, '.json');
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    const bookCount = new Map();
    let changed = false;

    for (const ch of data.chapters) {
      for (const s of ch.sections) {
        const before = s.text;
        const after = fixText(before, bookCount);
        if (after !== before) {
          changed = true;
          s.text = after;
        }
        // 替换后仍残留的类引用模式（书卷名无法识别）
        for (const u of findUnrecognizedRefs(after)) {
          unrecognized.push({
            file: bookId,
            where: `${ch.chapter}:${s.verses}`,
            match: u.match,
            context: after.slice(Math.max(0, u.index - CTX), u.index + u.match.length + CTX),
          });
        }
      }
    }

    const n = [...bookCount.values()].reduce((s, v) => s + v, 0);
    if (n) console.log(`  ${metaById[bookId]?.name ?? bookId} 替换 ${n} 处: ${fmtCounts(bookCount)}`);
    grandTotal += n;
    mergeInto(grandCount, bookCount);

    if (!changed) continue;
    changedFiles++;
    if (WRITE) {
      fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data));
      // 同步更新翻译缓存（只改 text，不动 srcHash——它哈希的是英文源文本）
      const cacheFile = path.join(CACHE_DIR, file);
      if (fs.existsSync(cacheFile)) {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        for (const key of Object.keys(cache)) {
          if (typeof cache[key]?.text === 'string') cache[key].text = replaceEnglishRefs(cache[key].text);
        }
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
      }
    }
  }

  console.log('\n================================================');
  console.log(`替换合计: ${grandTotal} 处（涉及 ${changedFiles} 卷）`);
  if (grandTotal) console.log(`按目标书卷: ${fmtCounts(grandCount)}`);

  console.log(`\n无法识别的类引用模式: ${unrecognized.length} 处`);
  for (const u of unrecognized) {
    console.log(`  - ${u.file} ${u.where}  "${u.match}"  …${u.context}…`);
  }

  if (WRITE) {
    console.log(`\n✓ 已写盘 ${changedFiles} 个数据文件，并同步 commentary-zh-cache`);
  } else if (grandTotal) {
    console.log('\n（dry-run，未写盘；确认无误后加 --write 应用）');
  }
}

main();
