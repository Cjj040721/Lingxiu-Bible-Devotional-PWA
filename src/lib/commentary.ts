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
