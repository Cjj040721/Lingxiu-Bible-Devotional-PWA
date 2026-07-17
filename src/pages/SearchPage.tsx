import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBibleIndex } from '../lib/bible';
import { searchBible, splitHighlight, type SearchHit } from '../lib/search';
import type { BibleIndex } from '../types/bible';

/** 搜索页：关键词全文检索，分批加载边搜边出结果 */
export default function SearchPage() {
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const [kw, setKw] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadBibleIndex().then(setIndex).catch(() => setSummary('目录加载失败'));
    return () => cancelRef.current?.();
  }, []);

  const runSearch = (keyword: string) => {
    if (!index) return;
    cancelRef.current?.();
    setHits([]);
    setSummary(null);
    const kw = keyword.trim();
    if (!kw) {
      setSearching(false);
      setProgress(null);
      return;
    }
    setSearching(true);
    setProgress({ loaded: 0, total: index.books.length });
    cancelRef.current = searchBible(index, kw, {
      onProgress: (loaded, total) => setProgress({ loaded, total }),
      onBatch: (batch) => setHits((h) => [...h, ...batch]),
      onDone: (total, truncated) => {
        setSearching(false);
        setSummary(
          total === 0
            ? `没有找到包含「${kw}」的经文`
            : `共找到 ${total} 处经文${truncated ? '，仅显示前 200 条' : ''}`,
        );
      },
      onError: () => {
        setSearching(false);
        setSummary('搜索出错，请重试');
      },
    });
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 pb-24 dark:bg-stone-950">
      <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 px-4 pt-4 pb-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <h1 className="pb-3 text-lg font-bold text-stone-800 dark:text-stone-100">经文搜索</h1>
        <div className="flex gap-2">
          <input
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(kw)}
            placeholder="输入关键词，如「平安」「恩典」「光」"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-[15px] text-stone-800 outline-none focus:border-indigo-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
          />
          <button
            onClick={() => runSearch(kw)}
            disabled={!kw.trim() || searching}
            className="shrink-0 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-indigo-600"
          >
            搜索
          </button>
        </div>
        {searching && progress && (
          <div className="pt-2 text-xs text-stone-400">
            正在搜索 {progress.loaded}/{progress.total} 卷…
          </div>
        )}
        {summary && <div className="pt-2 text-xs text-stone-400">{summary}</div>}
      </div>

      <ul className="divide-y divide-stone-100 px-4 dark:divide-stone-800/60">
        {hits.map((h, i) => (
          <li key={`${h.bookId}-${h.chapter}-${h.v}-${i}`}>
            <Link to={`/books/${h.bookId}/${h.chapter}`} className="block py-3">
              <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{h.label}</div>
              <p className="font-scripture mt-1 text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">
                {splitHighlight(h.text, kw.trim()).map((p, j) =>
                  p.hit ? (
                    <mark key={j} className="rounded bg-amber-200/70 px-0.5 text-stone-900 dark:bg-amber-500/50 dark:text-white">
                      {p.text}
                    </mark>
                  ) : (
                    <span key={j}>{p.text}</span>
                  ),
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {!searching && hits.length === 0 && !summary && (
        <div className="px-6 pt-16 text-center text-sm text-stone-400">
          输入关键词搜索全部 66 卷经文
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {['平安', '恩典', '信心', '爱', '光', '永生'].map((w) => (
              <button
                key={w}
                onClick={() => {
                  setKw(w);
                  runSearch(w);
                }}
                className="rounded-full border border-stone-300 px-4 py-1.5 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
