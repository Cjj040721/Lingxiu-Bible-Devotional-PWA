/**
 * 经文搜索：分批加载各卷 JSON，子串匹配，边搜边出结果。
 */
import type { BibleIndex } from '../types/bible';
import { loadBook, verseLabel } from './bible';

export interface SearchHit {
  bookId: string;
  bookName: string;
  chapter: number;
  v: number;
  end?: number;
  label: string; // 书卷 章:节
  text: string;
}

const BATCH_SIZE = 8;
const MAX_HITS = 200;

export interface SearchCallbacks {
  onProgress: (loadedBooks: number, totalBooks: number, hits: number) => void;
  onBatch: (hits: SearchHit[]) => void;
  onDone: (totalHits: number, truncated: boolean) => void;
  onError: (e: unknown) => void;
}

/** 启动一次搜索，返回取消函数 */
export function searchBible(index: BibleIndex, keyword: string, cb: SearchCallbacks): () => void {
  const kw = keyword.trim();
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  if (!kw) {
    cb.onDone(0, false);
    return cancel;
  }

  (async () => {
    let totalHits = 0;
    let truncated = false;
    const books = index.books;
    for (let i = 0; i < books.length && !cancelled; i += BATCH_SIZE) {
      const batch = books.slice(i, i + BATCH_SIZE);
      const loaded = await Promise.all(batch.map((b) => loadBook(b.bookId).catch(() => null)));
      if (cancelled) return;
      const hits: SearchHit[] = [];
      for (const book of loaded) {
        if (!book) continue;
        for (const ch of book.chapters) {
          for (const entry of ch.verses) {
            if (entry.t.includes(kw)) {
              totalHits++;
              if (totalHits <= MAX_HITS) {
                hits.push({
                  bookId: book.bookId,
                  bookName: book.name,
                  chapter: ch.chapter,
                  v: entry.v,
                  end: entry.end,
                  label: `${book.name} ${ch.chapter}:${verseLabel(entry)}`,
                  text: entry.t,
                });
              } else {
                truncated = true;
              }
            }
          }
        }
      }
      if (hits.length) cb.onBatch(hits);
      cb.onProgress(Math.min(i + BATCH_SIZE, books.length), books.length, totalHits);
    }
    if (!cancelled) cb.onDone(totalHits, truncated);
  })().catch((e) => {
    if (!cancelled) cb.onError(e);
  });

  return cancel;
}

/** 高亮关键词：把命中文本切成片段 */
export function splitHighlight(text: string, keyword: string): { text: string; hit: boolean }[] {
  const parts: { text: string; hit: boolean }[] = [];
  let rest = text;
  for (;;) {
    const i = rest.indexOf(keyword);
    if (i === -1) {
      if (rest) parts.push({ text: rest, hit: false });
      break;
    }
    if (i > 0) parts.push({ text: rest.slice(0, i), hit: false });
    parts.push({ text: keyword, hit: true });
    rest = rest.slice(i + keyword.length);
  }
  return parts;
}
