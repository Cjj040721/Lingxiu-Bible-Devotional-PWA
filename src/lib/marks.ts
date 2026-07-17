/** 书签 + 灵修笔记存储（仅存本地，可导出） */
import { createLocalStore } from './store';

export interface VerseRef {
  bookId: string;
  bookName: string;
  chapter: number;
  v: number;
  end?: number;
}

export interface Bookmark extends VerseRef {
  id: string;
  verseText: string;
  createdAt: number;
}

export interface Note extends VerseRef {
  id: string;
  verseText: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

interface MarksState {
  bookmarks: Bookmark[];
  notes: Note[];
}

export const marksStore = createLocalStore<MarksState>('lingxiu.marks.v1', {
  bookmarks: [],
  notes: [],
});

export function uid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function refText(ref: VerseRef): string {
  return `${ref.bookName} ${ref.chapter}:${ref.end && ref.end !== ref.v ? `${ref.v}-${ref.end}` : ref.v}`;
}

export function addBookmark(b: Omit<Bookmark, 'id' | 'createdAt'>) {
  marksStore.update((s) => ({ ...s, bookmarks: [{ ...b, id: uid(), createdAt: Date.now() }, ...s.bookmarks] }));
}

export function removeBookmark(id: string) {
  marksStore.update((s) => ({ ...s, bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
}

export function addNote(n: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) {
  marksStore.update((s) => ({
    ...s,
    notes: [{ ...n, id: uid(), createdAt: Date.now(), updatedAt: Date.now() }, ...s.notes],
  }));
}

export function updateNote(id: string, note: string) {
  marksStore.update((s) => ({
    ...s,
    notes: s.notes.map((n) => (n.id === id ? { ...n, note, updatedAt: Date.now() } : n)),
  }));
}

export function removeNote(id: string) {
  marksStore.update((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
}

/** 导出笔记与书签为 JSON 文件下载 */
export function exportMarks() {
  const data = marksStore.get();
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `灵修伴读-笔记书签-${todayFileStamp()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function todayFileStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
