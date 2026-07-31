/**
 * 注解翻译脚本（MHCC 英文中间数据 → 简体中文，OpenAI 兼容接口 / DeepSeek）
 *
 * 输入: scripts/raw/commentary-en/{bookId}.json（convert-commentary.mjs 的产物）
 * 输出: public/data/commentary/{bookId}.json
 *   { "bookId": "mat", "source": "马太亨利简明圣经注释（1706 年原著，公有领域）· AI 中译",
 *     "chapters": [ { "chapter": 5, "sections": [ { "verses": "1-12", "text": "……" } ] } ] }
 *
 * 环境变量（可写在 app/.env.local，格式 KEY=VALUE，不入库）:
 *   OPENAI_API_KEY   必填（如 DeepSeek 的 sk-...）
 *   OPENAI_BASE_URL  默认 https://api.deepseek.com/v1
 *   MODEL            默认 deepseek-chat
 *
 * 批量与续传：
 *   - 一章内的 sections 合并为一次请求（编号列表输入，要求按编号返回 JSON 数组），
 *     单批输入超过 MAX_BATCH_CHARS 即拆批，避免输出超限
 *   - 每卷一个缓存文件 scripts/raw/commentary-zh-cache/{bookId}.json，
 *     每批成功即落盘，中断后重跑自动续传（源文本哈希不一致的段会重翻）
 *   - 429/5xx 指数退避重试，请求间固定间隔限速
 *   - 译文写盘前统一过 replaceEnglishRefs（lib/commentary-refs.mjs），
 *     把残留英文书卷引用（Joh 3:16 等）替换为中文简称（约 3:16）
 *
 * 运行:
 *   node scripts/translate-commentary.mjs            # 翻译全部 66 卷
 *   node scripts/translate-commentary.mjs mat psa    # 只翻译指定卷
 *   node scripts/translate-commentary.mjs --dry-run  # 只打印统计与 token 估算，不调接口
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';
import { replaceEnglishRefs } from './lib/commentary-refs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const EN_DIR = path.join(__dirname, 'raw', 'commentary-en');
const CACHE_DIR = path.join(__dirname, 'raw', 'commentary-zh-cache');
const OUT_DIR = path.join(APP_DIR, 'public', 'data', 'commentary');

const SOURCE_ZH = '马太亨利简明圣经注释（1706 年原著，公有领域）· AI 中译';

/** 单批最大输入字符数（约 1.5K token，译文输出留足余量） */
const MAX_BATCH_CHARS = 6000;
/** 请求间隔（限速） */
const REQUEST_INTERVAL_MS = 300;
/** 失败重试次数（429/5xx 指数退避） */
const MAX_RETRIES = 5;

const SYSTEM_PROMPT = `你是资深的圣经学者与中文译者，负责把马太亨利简明圣经注释（Matthew Henry's Concise Commentary）译为简体中文。要求：
1. 语言：简体中文，面向中文基督徒灵修阅读，行文庄重、通顺、忠实原文。
2. 术语与中文和合本一致：如「耶和华」「耶稣基督」「圣灵」「使徒」「福音」「恩典」「救赎」；旧约人名地名用和合本译名。
3. 保留经文引用格式（如 "Ge 12:3"、"Joh 3:16" 原样保留，不翻译书卷缩写）。
4. 只翻译，不删减、不概括、不评注；原文的编号要点（1. 2. 3.）原样保留。
5. 输入是编号列表 [n]，输出必须是 JSON 对象 {"translations": ["...译文1...", "...译文2...", ...]}，数组长度、顺序与输入编号一一对应。`;

// ---------- 命令行参数 ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const ALL_BOOK_IDS = BOOKS_META.map((b) => b.bookId); // 全本 66 卷(CAO-20 起含旧约)
const requested = args.filter((a) => !a.startsWith('--'));
const unknown = requested.filter((id) => !ALL_BOOK_IDS.includes(id));
if (unknown.length) {
  console.error(`未知书卷ID: ${unknown.join(', ')}`);
  console.error(`可用: ${ALL_BOOK_IDS.join(' ')}`);
  process.exit(1);
}
const targetBooks = requested.length ? requested : ALL_BOOK_IDS;

// ---------- 环境变量（.env.local 简单解析，不引依赖） ----------
function loadEnvLocal() {
  const file = path.join(APP_DIR, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^["']|["']$/g, '');
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
}
loadEnvLocal();

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
const MODEL = process.env.MODEL || 'deepseek-chat';

// ---------- 工具 ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 源文本短哈希（用于缓存失效判断，FNV-1a） */
function shortHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** 粗估 token：英文约 4 字符/token，中文约 1.5 字符/token */
const estTokensEn = (chars) => Math.ceil(chars / 4);
const estTokensZh = (zhChars) => Math.ceil(zhChars / 1.5);

/** 把一章的 sections 按输入长度分批（返回元素为 section 对象的数组） */
function makeBatches(sections) {
  const batches = [];
  let cur = [];
  let curChars = 0;
  for (const sec of sections) {
    const len = sec.text.length;
    if (cur.length && curChars + len > MAX_BATCH_CHARS) {
      batches.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(sec);
    curChars += len;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** 调 OpenAI 兼容 chat/completions，带 429/5xx 指数退避重试 */
async function translateBatch(texts) {
  const userContent =
    '请翻译以下编号段落，返回 JSON 对象 {"translations": [...]}：\n\n' +
    texts.map((t, i) => `[${i + 1}] ${t}`).join('\n\n');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
        }),
      });
    } catch (err) {
      if (attempt === MAX_RETRIES) throw new Error(`网络错误（重试${MAX_RETRIES}次仍失败）: ${err.message}`);
      await sleep(1000 * 2 ** (attempt - 1));
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? '';
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
      const translations = parsed?.translations;
      if (!Array.isArray(translations) || translations.length !== texts.length) {
        // 模型偶发返回非 JSON 或译文数量不符:按瞬态错误重试(与 429/5xx 同策略)
        if (attempt === MAX_RETRIES) {
          if (texts.length > 1) {
            // 持久性数量不符(模型对特定批次反复拆错):拆半递归翻译后拼接
            const mid = Math.ceil(texts.length / 2);
            console.warn(`  ⚠ 批次译文数量持续不符(期望${texts.length})，拆半重试`);
            const left = await translateBatch(texts.slice(0, mid));
            const right = await translateBatch(texts.slice(mid));
            return [...left, ...right];
          }
          if (Array.isArray(translations) && translations.length > 0) {
            console.warn('  ⚠ 单段翻译返回多条译文，取第一条');
            return [String(translations[0]).trim()];
          }
          throw new Error(`译文数量不符: 期望1 实际0（重试${MAX_RETRIES}次仍失败）`);
        }
        await sleep(1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
        continue;
      }
      return translations.map((t) => String(t).trim());
    }

    const body = await res.text().catch(() => '');
    if (res.status === 429 || res.status >= 500) {
      if (attempt === MAX_RETRIES) throw new Error(`HTTP ${res.status}（重试${MAX_RETRIES}次仍失败）: ${body.slice(0, 200)}`);
      await sleep(1000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500));
      continue;
    }
    // 4xx（除 429）多为配置问题，直接报错
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  throw new Error('unreachable');
}

// ---------- 主流程 ----------
async function main() {
  if (!DRY_RUN && !API_KEY) {
    console.error('缺少 OPENAI_API_KEY：请在环境变量或 app/.env.local 中配置后重试。');
    console.error('（先用 --dry-run 可查看待翻译规模与 token 估算）');
    process.exit(1);
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let grandBatches = 0;
  let grandInputChars = 0;
  let grandCached = 0;
  let grandTodo = 0;

  for (const bookId of targetBooks) {
    const enFile = path.join(EN_DIR, `${bookId}.json`);
    if (!fs.existsSync(enFile)) {
      console.error(`缺少英文中间数据: ${path.relative(APP_DIR, enFile)}（先运行 npm run convert:commentary）`);
      process.exit(1);
    }
    const book = JSON.parse(fs.readFileSync(enFile, 'utf8'));
    const cacheFile = path.join(CACHE_DIR, `${bookId}.json`);
    /** 缓存: { "章:段序号": { verses, srcHash, text } } */
    const cache = !FORCE && fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

    // 统计
    let bookBatches = 0;
    let bookInputChars = 0;
    let bookTodo = 0;
    let bookCached = 0;
    for (const ch of book.chapters) {
      const pendingIdx = ch.sections
        .map((s, i) => ({ s, i }))
        .filter(({ s, i }) => cache[`${ch.chapter}:${i}`]?.srcHash !== shortHash(s.text) || cache[`${ch.chapter}:${i}`]?.verses !== s.verses)
        .map(({ i }) => i);
      bookCached += ch.sections.length - pendingIdx.length;
      bookTodo += pendingIdx.length;
      for (const batch of makeBatches(pendingIdx.map((i) => ch.sections[i]))) {
        bookBatches++;
        bookInputChars += batch.reduce((s, sec) => s + sec.text.length, 0);
      }
    }

    const meta = BOOKS_META.find((b) => b.bookId === bookId);
    const totalSections = book.chapters.reduce((s, c) => s + c.sections.length, 0);
    console.log(
      `${DRY_RUN ? '[dry-run] ' : ''}${meta.name.padEnd(6, '　')} ${book.chapters.length}章 ${totalSections}段 ` +
        `待翻${bookTodo} 已缓存${bookCached} 请求${bookBatches}次 ` +
        `输入≈${estTokensEn(bookInputChars)}tok 输出≈${estTokensZh(Math.ceil(bookInputChars * 0.7))}tok`,
    );
    grandBatches += bookBatches;
    grandInputChars += bookInputChars;
    grandCached += bookCached;
    grandTodo += bookTodo;

    if (DRY_RUN || bookTodo === 0) {
      if (!DRY_RUN && bookTodo === 0) writeFinal(bookId, book, cache);
      continue;
    }

    // 逐章逐批翻译，批成功即写缓存（可断点续传）
    for (const ch of book.chapters) {
      const pendingIdx = ch.sections
        .map((s, i) => i)
        .filter((i) => cache[`${ch.chapter}:${i}`]?.srcHash !== shortHash(ch.sections[i].text) || cache[`${ch.chapter}:${i}`]?.verses !== ch.sections[i].verses);
      for (const batch of makeBatches(pendingIdx.map((i) => ch.sections[i]))) {
        const texts = batch.map((sec) => sec.text);
        const translations = await translateBatch(texts);
        batch.forEach((sec, k) => {
          const idx = ch.sections.indexOf(sec);
          cache[`${ch.chapter}:${idx}`] = { verses: sec.verses, srcHash: shortHash(sec.text), text: replaceEnglishRefs(translations[k]) };
        });
        fs.writeFileSync(cacheFile, JSON.stringify(cache));
        await sleep(REQUEST_INTERVAL_MS);
      }
    }
    writeFinal(bookId, book, cache);
    console.log(`  ✓ ${meta.name} 翻译完成`);
  }

  console.log(
    `\n${DRY_RUN ? '[dry-run] ' : ''}合计: ${targetBooks.length}卷 待翻${grandTodo}段 已缓存${grandCached}段 ` +
      `请求${grandBatches}次 输入≈${estTokensEn(grandInputChars)}tok 输出≈${estTokensZh(Math.ceil(grandInputChars * 0.7))}tok`,
  );
}

/** 全部段都有译文后，组装最终产物 public/data/commentary/{bookId}.json */
function writeFinal(bookId, book, cache) {
  const chapters = book.chapters.map((ch) => ({
    chapter: ch.chapter,
    sections: ch.sections.map((s, i) => {
      const hit = cache[`${ch.chapter}:${i}`];
      if (!hit || hit.srcHash !== shortHash(s.text)) throw new Error(`${bookId} ${ch.chapter}:${i} 缺少译文，无法产出最终文件`);
      // 旧缓存可能未过引用替换，产出前再跑一遍（幂等）
      return { verses: s.verses, text: replaceEnglishRefs(hit.text) };
    }),
  }));
  const out = { bookId, source: SOURCE_ZH, chapters };
  fs.writeFileSync(path.join(OUT_DIR, `${bookId}.json`), JSON.stringify(out));
}

main().catch((err) => {
  console.error(`翻译中断: ${err.stack ?? err.message}`);
  console.error('已翻译的批次已写入缓存，重跑本命令即可续传。');
  process.exit(1);
});
