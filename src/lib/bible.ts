/**
 * 圣经数据访问层：按需加载 index.json 与单卷 JSON，带内存缓存。
 * 后续扩展（搜索、注解、打卡）都应通过这一层取数据。
 */
import type { BibleIndex, BookData, BookMeta } from '../types/bible';

const BASE = `${import.meta.env.BASE_URL}data/bible`;

let indexPromise: Promise<BibleIndex> | null = null;
const bookPromises = new Map<string, Promise<BookData>>();

export function loadBibleIndex(): Promise<BibleIndex> {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`).then((r) => {
      if (!r.ok) throw new Error(`加载圣经索引失败: ${r.status}`);
      return r.json() as Promise<BibleIndex>;
    });
  }
  return indexPromise;
}

export function loadBook(bookId: string): Promise<BookData> {
  let p = bookPromises.get(bookId);
  if (!p) {
    p = fetch(`${BASE}/books/${bookId}.json`).then((r) => {
      if (!r.ok) throw new Error(`加载书卷失败 ${bookId}: ${r.status}`);
      return r.json() as Promise<BookData>;
    });
    bookPromises.set(bookId, p);
  }
  return p;
}

export function findBookMeta(index: BibleIndex, bookId: string): BookMeta | undefined {
  return index.books.find((b) => b.bookId === bookId);
}

export interface ChapterRef {
  bookId: string;
  chapter: number;
}

/** 计算上一章/下一章（跨卷）；到圣经首尾返回 null */
export function adjacentChapter(
  index: BibleIndex,
  bookId: string,
  chapter: number,
  dir: 'prev' | 'next',
): ChapterRef | null {
  const meta = findBookMeta(index, bookId);
  if (!meta) return null;
  if (dir === 'prev') {
    if (chapter > 1) return { bookId, chapter: chapter - 1 };
    if (meta.order === 1) return null;
    const prevBook = index.books[meta.order - 2];
    return { bookId: prevBook.bookId, chapter: prevBook.chapters };
  }
  if (chapter < meta.chapters) return { bookId, chapter: chapter + 1 };
  if (meta.order === index.books.length) return null;
  const nextBook = index.books[meta.order];
  return { bookId: nextBook.bookId, chapter: 1 };
}

/** 节标签：单节显示数字，合节显示 "6-8" */
export function verseLabel(v: { v: number; end?: number }): string {
  return v.end ? `${v.v}-${v.end}` : `${v.v}`;
}
