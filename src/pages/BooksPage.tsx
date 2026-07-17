import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBibleIndex } from '../lib/bible';
import type { BibleIndex } from '../types/bible';

type Tab = 'old' | 'new';

/** 卷列表页：旧约/新约两个 Tab，显示卷名 + 章数 */
export default function BooksPage() {
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('old');

  useEffect(() => {
    loadBibleIndex()
      .then(setIndex)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <Centered>数据加载失败：{error}</Centered>;
  if (!index) return <Centered>正在加载圣经目录…</Centered>;

  const books = index.books.filter((b) => b.testament === tab);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 pb-8 dark:bg-stone-950">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-4 pt-4 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="flex items-center gap-3 pb-3">
          <Link to="/" className="text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-200" aria-label="返回首页">
            ←
          </Link>
          <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100">圣经 · 和合本</h1>
        </div>
        <div className="flex rounded-xl bg-stone-200/70 p-1 dark:bg-stone-800">
          {(
            [
              ['old', `旧约 ${index.books.filter((b) => b.testament === 'old').length} 卷`],
              ['new', `新约 ${index.books.filter((b) => b.testament === 'new').length} 卷`],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                tab === key
                  ? 'bg-white text-indigo-700 shadow dark:bg-stone-900 dark:text-indigo-300'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-2 px-4 pt-4">
        {books.map((b) => (
          <li key={b.bookId}>
            <Link
              to={`/books/${b.bookId}`}
              className="flex items-baseline justify-between rounded-xl border border-stone-200 bg-white px-4 py-3 transition active:scale-[0.98] dark:border-stone-800 dark:bg-stone-900"
            >
              <span className="font-medium text-stone-800 dark:text-stone-100">{b.name}</span>
              <span className="text-xs text-stone-400 dark:text-stone-500">{b.chapters} 章</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-stone-50 px-6 text-center text-sm text-stone-500 dark:bg-stone-950 dark:text-stone-400">
      {children}
    </div>
  );
}
