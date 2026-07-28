/**
 * 逐节简注生成脚本（经文 + MHCC 中文注解 → 每节一条 AI 简注，OpenAI 兼容接口 / DeepSeek）
 *
 * 输入:
 *   经文    public/data/bible/books/{bookId}.json
 *     { "chapters": [ { "chapter": 5, "verses": [ { "v": 1, "end"?: 3, "t": "……" } ] } ] }
 *     （end 表示合节 v-end，如 {v:1,end:3} 即 1-3 节合并为一行）
 *   MHCC 注解 public/data/commentary/{bookId}.json（translate-commentary.mjs 的产物，节段格式）
 * 输出: public/data/commentary-verses/{bookId}.json
 *   { "bookId": "mat", "source": "依据马太亨利简明注释（公有领域）AI 生成",
 *     "chapters": [ { "chapter": 5, "notes": [ { "v": 1, "note": "……" } ] } ] }
 *   合节按起始节号输出一条。
 *
 * 环境变量（可写在 app/.env.local，格式 KEY=VALUE，不入库）:
 *   OPENAI_API_KEY   必填（如 DeepSeek 的 sk-...）
 *   OPENAI_BASE_URL  默认 https://api.deepseek.com/v1
 *   MODEL            默认 deepseek-chat
 *
 * 批量与续传：
 *   - 每章一次请求：该章全部经文（带节号）+ 该章 MHCC 注解全文发给模型，
 *     要求返回 JSON 对象 {"notes": [{"v": 1, "note": "……"}, ...]}，覆盖该章每一节
 *   - 每章结果落盘 scripts/raw/verse-notes-cache/{bookId}/{chapter}.json，重跑自动跳过
 *   - 429/5xx 及模型返回非法 JSON 均指数退避重试，请求间固定间隔限速
 *   - 每章完成后校验节号覆盖：缺失节号打印告警并写入缓存文件 warnings 字段，
 *     仍落盘（可用 --force 重生成该章）
 *
 * 运行:
 *   node scripts/build-verse-notes.mjs              # 生成全部 29 卷
 *   node scripts/build-verse-notes.mjs mat psa      # 只生成指定卷
 *   node scripts/build-verse-notes.mjs mat:5 psa:23 # 只生成指定章（便于试跑/单章重生成）
 *   node scripts/build-verse-notes.mjs --dry-run    # 只打印统计与 token 估算，不调接口
 *   node scripts/build-verse-notes.mjs mat --force  # 忽略缓存重生成（与 mat:5 同用时只清该章）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_META } from './books-meta.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(__dirname, '..');
const BIBLE_DIR = path.join(APP_DIR, 'public', 'data', 'bible', 'books');
const COMMENTARY_DIR = path.join(APP_DIR, 'public', 'data', 'commentary');
const CACHE_ROOT = path.join(__dirname, 'raw', 'verse-notes-cache');
const OUT_DIR = path.join(APP_DIR, 'public', 'data', 'commentary-verses');

const SOURCE_ZH = '依据马太亨利简明注释（公有领域）AI 生成';

/** 请求间隔（限速） */
const REQUEST_INTERVAL_MS = 300;
/** 失败重试次数（429/5xx/非法 JSON 指数退避） */
const MAX_RETRIES = 5;

const SYSTEM_PROMPT = `你是资深的圣经学者，负责为中文基督徒灵修阅读撰写逐节简注。依据材料是马太亨利简明圣经注释（Matthew Henry's Concise Commentary）的中译文，以及所提供的经文本身（和合本）。要求：
1. 语言：简体中文，基督教灵修语境，行文简洁庄重；术语与中文和合本一致（如「耶和华」「耶稣基督」「圣灵」「恩典」）。
2. 每节输出一条 note，1-2 句、不超过 80 字。
3. 严格依据所提供的马太亨利注释内容提炼；注释未论及的节，依据该节经文本身与上下文给出简短中性的解释，不得编造背景知识。
4. 覆盖输入的每一个节号（合节按起始节号输出一条），不多不少。
5. 只输出 JSON 对象 {"notes": [{"v": 1, "note": "……"}, ...]}，不要任何额外文字。`;

// ---------- 命令行参数 ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const V1_BOOK_IDS = BOOKS_META.filter((b) => b.testament === 'new' || b.bookId === 'psa' || b.bookId === 'pro').map(
  (b) => b.bookId,
);
const requested = args.filter((a) => !a.startsWith('--'));
// 支持 mat:5 形式只跑指定章（便于试跑与单章重生成）
const chapterFilters = new Map(); // bookId -> Set<章号>
const requestedBooks = [];
for (const a of requested) {
  const m = a.match(/^([a-z0-9]+):(\d+)$/);
  if (m) {
    if (!chapterFilters.has(m[1])) chapterFilters.set(m[1], new Set());
    chapterFilters.get(m[1]).add(Number(m[2]));
    if (!requestedBooks.includes(m[1])) requestedBooks.push(m[1]);
  } else if (!requestedBooks.includes(a)) {
    requestedBooks.push(a);
  }
}
const unknown = requestedBooks.filter((id) => !V1_BOOK_IDS.includes(id));
if (unknown.length) {
  console.error(`未知书卷ID: ${unknown.join(', ')}`);
  console.error(`V1 可用: ${V1_BOOK_IDS.join(' ')}`);
  process.exit(1);
}
const targetBooks = requestedBooks.length ? requestedBooks : V1_BOOK_IDS;

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

/** 粗估 token：中文约 1.5 字符/token */
const estTokensZh = (zhChars) => Math.ceil(zhChars / 1.5);

/** 经文行渲染：合节显示 "1-3."，单节显示 "1." */
function verseLine(v) {
  return `${v.end ? `${v.v}-${v.end}` : v.v}. ${v.t}`;
}

/** 拼装一章的用户消息（经文 + MHCC 注解全文） */
function buildUserContent(chapterVerses, sections) {
  const verseText = chapterVerses.map(verseLine).join('\n');
  const commentaryText =
    sections.length > 0
      ? sections.map((s) => `【${s.verses}】${s.text}`).join('\n\n')
      : '（本章暂无马太亨利注释，请依据经文本身与上下文给出简短中性的解释。）';
  return (
    `请为以下这一章的每一节撰写简注，返回 JSON 对象 {"notes": [{"v": 1, "note": "……"}, ...]}。\n\n` +
    `【经文】\n${verseText}\n\n【马太亨利简明注释（本章）】\n${commentaryText}`
  );
}

/** 调 OpenAI 兼容 chat/completions，带 429/5xx/非法 JSON 指数退避重试 */
async function generateChapterNotes(userContent, expectedCount) {
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
      } catch (err) {
        if (attempt === MAX_RETRIES) throw new Error(`模型返回非 JSON（重试${MAX_RETRIES}次仍失败）: ${err.message}`);
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      const notes = Array.isArray(parsed) ? parsed : parsed.notes;
      if (!Array.isArray(notes)) {
        if (attempt === MAX_RETRIES) throw new Error('模型返回缺少 notes 数组');
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      const cleaned = [];
      for (const n of notes) {
        const v = Number(n?.v);
        const note = String(n?.note ?? '').trim();
        if (!Number.isInteger(v) || v < 1 || !note) continue;
        cleaned.push({ v, note });
      }
      if (cleaned.length === 0) {
        if (attempt === MAX_RETRIES) throw new Error('模型返回的 notes 为空或无有效条目');
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      if (cleaned.length < expectedCount) {
        console.warn(`  ! 返回 ${cleaned.length} 条，少于本章节号数 ${expectedCount}（第${attempt}次尝试）`);
        if (attempt === MAX_RETRIES) return cleaned; // 仍返回，由覆盖校验记录告警
        await sleep(1000 * 2 ** (attempt - 1));
        continue;
      }
      return cleaned;
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

/** 校验返回的 v 是否覆盖该章全部起始节号，返回缺失列表 */
function findMissing(notes, chapterVerses) {
  const have = new Set(notes.map((n) => n.v));
  return chapterVerses.map((v) => v.v).filter((v) => !have.has(v));
}

// ---------- 主流程 ----------
async function main() {
  if (!DRY_RUN && !API_KEY) {
    console.error('缺少 OPENAI_API_KEY：请在环境变量或 app/.env.local 中配置后重试。');
    console.error('（先用 --dry-run 可查看待生成规模与 token 估算）');
    process.exit(1);
  }
  fs.mkdirSync(CACHE_ROOT, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let grandChapters = 0;
  let grandTodo = 0;
  let grandCached = 0;
  let grandInputChars = 0;
  let grandOutputChars = 0;
  let grandWarnings = 0;

  for (const bookId of targetBooks) {
    const bibleFile = path.join(BIBLE_DIR, `${bookId}.json`);
    const commentaryFile = path.join(COMMENTARY_DIR, `${bookId}.json`);
    if (!fs.existsSync(bibleFile)) {
      console.error(`缺少经文数据: ${path.relative(APP_DIR, bibleFile)}`);
      process.exit(1);
    }
    if (!fs.existsSync(commentaryFile)) {
      console.error(`缺少 MHCC 注解: ${path.relative(APP_DIR, commentaryFile)}（先运行 npm run translate:commentary）`);
      process.exit(1);
    }
    const bible = JSON.parse(fs.readFileSync(bibleFile, 'utf8'));
    const commentary = JSON.parse(fs.readFileSync(commentaryFile, 'utf8'));
    const commentaryByChapter = new Map(commentary.chapters.map((c) => [c.chapter, c.sections]));

    // 章过滤（mat:5 形式）；校验指定章存在
    const filter = chapterFilters.get(bookId);
    let chaptersToProcess = bible.chapters;
    if (filter) {
      const valid = new Set(bible.chapters.map((c) => c.chapter));
      const bad = [...filter].filter((n) => !valid.has(n));
      if (bad.length) {
        console.error(`${bookId} 不存在章: ${bad.join(', ')}`);
        process.exit(1);
      }
      chaptersToProcess = bible.chapters.filter((c) => filter.has(c.chapter));
    }

    const bookCacheDir = path.join(CACHE_ROOT, bookId);
    if (FORCE) {
      // 指定章时只删对应章缓存，否则清整卷缓存
      if (filter) {
        for (const n of filter) fs.rmSync(path.join(bookCacheDir, `${n}.json`), { force: true });
      } else if (fs.existsSync(bookCacheDir)) {
        fs.rmSync(bookCacheDir, { recursive: true });
      }
    }
    fs.mkdirSync(bookCacheDir, { recursive: true });

    // 统计
    let bookTodo = 0;
    let bookCached = 0;
    let bookInputChars = 0;
    let bookOutputChars = 0;
    for (const ch of chaptersToProcess) {
      const cacheFile = path.join(bookCacheDir, `${ch.chapter}.json`);
      const done = fs.existsSync(cacheFile);
      if (done) bookCached++;
      else {
        bookTodo++;
        const sections = commentaryByChapter.get(ch.chapter) ?? [];
        bookInputChars += buildUserContent(ch.verses, sections).length;
        bookOutputChars += ch.verses.length * 60; // 每节约 60 字估算
      }
    }

    const meta = BOOKS_META.find((b) => b.bookId === bookId);
    console.log(
      `${DRY_RUN ? '[dry-run] ' : ''}${meta.name.padEnd(6, '　')} ${chaptersToProcess.length}章 ` +
        `待生成${bookTodo} 已缓存${bookCached} 请求${bookTodo}次 ` +
        `输入≈${estTokensZh(bookInputChars)}tok 输出≈${estTokensZh(bookOutputChars)}tok`,
    );
    grandChapters += chaptersToProcess.length;
    grandTodo += bookTodo;
    grandCached += bookCached;
    grandInputChars += bookInputChars;
    grandOutputChars += bookOutputChars;

    if (DRY_RUN) continue;

    // 逐章生成，章成功即写缓存（可断点续传）
    let bookWarnings = 0;
    for (const ch of chaptersToProcess) {
      const cacheFile = path.join(bookCacheDir, `${ch.chapter}.json`);
      if (fs.existsSync(cacheFile)) {
        const prev = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (prev.warnings?.length) {
          console.warn(`  ! ${bookId} ${ch.chapter}章（缓存）缺失节号: ${prev.warnings.join(', ')}（--force 可重生成）`);
          bookWarnings += prev.warnings.length;
        }
        continue;
      }
      const sections = commentaryByChapter.get(ch.chapter) ?? [];
      const notes = await generateChapterNotes(buildUserContent(ch.verses, sections), ch.verses.length);
      const missing = findMissing(notes, ch.verses);
      if (missing.length) {
        console.warn(`  ! ${bookId} ${ch.chapter}章缺失节号: ${missing.join(', ')}（--force 可重生成）`);
        bookWarnings += missing.length;
      }
      // 按节号排序去重（保留首条），与缺失告警一并落盘
      const seen = new Set();
      const deduped = notes
        .filter((n) => !seen.has(n.v) && seen.add(n.v))
        .sort((a, b) => a.v - b.v);
      fs.writeFileSync(cacheFile, JSON.stringify({ notes: deduped, warnings: missing }, null, 2));
      await sleep(REQUEST_INTERVAL_MS);
    }
    writeFinal(bookId, bible, bookCacheDir);
    grandWarnings += bookWarnings;
    console.log(`  ✓ ${meta.name} 生成完成${bookWarnings ? `（${bookWarnings} 个节号缺失告警）` : ''}`);
  }

  console.log(
    `\n${DRY_RUN ? '[dry-run] ' : ''}合计: ${targetBooks.length}卷 ${grandChapters}章 待生成${grandTodo}章 已缓存${grandCached}章 ` +
      `请求${grandTodo}次 输入≈${estTokensZh(grandInputChars)}tok 输出≈${estTokensZh(grandOutputChars)}tok` +
      (grandWarnings ? ` 节号缺失告警${grandWarnings}处` : ''),
  );
}

/** 全部章都有缓存后，组装最终产物 public/data/commentary-verses/{bookId}.json */
function writeFinal(bookId, bible, bookCacheDir) {
  const missing = bible.chapters.filter((ch) => !fs.existsSync(path.join(bookCacheDir, `${ch.chapter}.json`)));
  if (missing.length) {
    console.log(`  … ${bookId} 还差 ${missing.length} 章未生成，暂不产出最终文件`);
    return;
  }
  const chapters = bible.chapters.map((ch) => {
    const { notes } = JSON.parse(fs.readFileSync(path.join(bookCacheDir, `${ch.chapter}.json`), 'utf8'));
    return { chapter: ch.chapter, notes };
  });
  const out = { bookId, source: SOURCE_ZH, chapters };
  fs.writeFileSync(path.join(OUT_DIR, `${bookId}.json`), JSON.stringify(out));
}

main().catch((err) => {
  console.error(`生成中断: ${err.stack ?? err.message}`);
  console.error('已生成的章已写入缓存，重跑本命令即可续传。');
  process.exit(1);
});
