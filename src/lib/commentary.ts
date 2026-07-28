/**
 * 经文注解数据访问（公有领域释经资料，如马太亨利注释）。
 * 数据文件：/data/commentary/{bookId}.json（按卷拆分，可选，未提供的卷显示"整理中"）
 * 格式约定见 app/README.md「注解数据格式」。
 */

export interface CommentarySection {
  /** 覆盖的节范围，如 "1-3"、"5" */
  verses: string;
  text: string;
}

export interface CommentaryChapter {
  chapter: number;
  sections: CommentarySection[];
}

export interface CommentaryBook {
  bookId: string;
  source: string;
  chapters: CommentaryChapter[];
}

const cache = new Map<string, Promise<CommentaryBook | null>>();

export function loadCommentary(bookId: string): Promise<CommentaryBook | null> {
  let p = cache.get(bookId);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/commentary/${bookId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<CommentaryBook>) : null))
      .catch(() => null);
    cache.set(bookId, p);
  }
  return p;
}

/* ---------------- 逐节简注（AI 依据 MHCC 生成，每节一条） ---------------- */

export interface VerseNote {
  /** 节号（合节取起始节） */
  v: number;
  note: string;
}

export interface VerseNotesChapter {
  chapter: number;
  notes: VerseNote[];
}

export interface VerseNotesBook {
  bookId: string;
  source: string;
  chapters: VerseNotesChapter[];
}

const verseCache = new Map<string, Promise<VerseNotesBook | null>>();

/** 逐节简注：/data/commentary-verses/{bookId}.json（未提供的卷返回 null） */
export function loadVerseNotes(bookId: string): Promise<VerseNotesBook | null> {
  let p = verseCache.get(bookId);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/commentary-verses/${bookId}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<VerseNotesBook>) : null))
      .catch(() => null);
    verseCache.set(bookId, p);
  }
  return p;
}
