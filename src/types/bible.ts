/** 圣经数据类型定义（与 public/data/bible 下的 JSON 结构对应） */

export interface BookMeta {
  bookId: string;
  name: string;
  abbr: string;
  testament: 'old' | 'new';
  order: number;
  chapters: number;
  verses: number;
}

export interface BibleIndex {
  version: string;
  versionName: string;
  totalBooks: number;
  totalChapters: number;
  totalVerses: number;
  books: BookMeta[];
}

/** 一节或一段合节；end 存在时表示 v-end 合节（如 6-8） */
export interface VerseEntry {
  v: number;
  end?: number;
  t: string;
}

export interface ChapterData {
  chapter: number;
  verses: VerseEntry[];
}

export interface BookData {
  bookId: string;
  name: string;
  abbr: string;
  testament: 'old' | 'new';
  order: number;
  chapters: ChapterData[];
}
