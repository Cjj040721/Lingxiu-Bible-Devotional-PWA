import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { findBookMeta, loadBibleIndex } from '../lib/bible';
import type { BookMeta } from '../types/bible';

/** 章选择页：数字网格 */
export default function ChaptersPage() {
  const { bookId = '' } = useParams();
  const [meta, setMeta] = useState<BookMeta | null | undefined>(undefined);

  useEffect(() => {
    loadBibleIndex()
      .then((idx) => setMeta(findBookMeta(idx, bookId) ?? null))
      .catch(() => setMeta(null));
  }, [bookId]);

  if (meta === null) return <Navigate to="/books" replace />;
  if (meta === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-stone-50 text-sm text-stone-500 dark:bg-stone-950 dark:text-stone-400">
        正在加载…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 pb-8 dark:bg-stone-950">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-stone-200 bg-stone-50/95 px-4 py-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <Link to="/books" className="text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-200" aria-label="返回卷列表">
          ←
        </Link>
        <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100">{meta.name}</h1>
        <span className="text-sm text-stone-400">共 {meta.chapters} 章</span>
      </header>

      <div className="grid grid-cols-5 gap-2 px-4 pt-4">
        {Array.from({ length: meta.chapters }, (_, i) => i + 1).map((ch) => (
          <Link
            key={ch}
            to={`/books/${meta.bookId}/${ch}`}
            className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-3 text-base font-medium text-stone-700 transition active:scale-95 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200"
          >
            {ch}
          </Link>
        ))}
      </div>
    </div>
  );
}
