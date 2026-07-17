import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { exportMarks, marksStore, refText, removeBookmark, removeNote, updateNote } from '../lib/marks';
import { useStore } from '../lib/store';

type Filter = 'all' | 'notes' | 'bookmarks';

/** 笔记页：笔记 + 书签时间线，支持编辑/删除/导出 */
export default function NotesPage() {
  const { notes, bookmarks } = useStore(marksStore);
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const items = useMemo(() => {
    const ns = notes.map((n) => ({ kind: 'note' as const, at: n.updatedAt, data: n }));
    const bs = bookmarks.map((b) => ({ kind: 'bookmark' as const, at: b.createdAt, data: b }));
    return [...ns, ...bs]
      .filter((i) => (filter === 'all' ? true : filter === 'notes' ? i.kind === 'note' : i.kind === 'bookmark'))
      .sort((a, b) => b.at - a.at);
  }, [notes, bookmarks, filter]);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 px-4 pt-6 pb-24 dark:bg-stone-950">
      <div className="flex items-center justify-between pb-4">
        <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100">笔记与书签</h1>
        {items.length > 0 && (
          <button onClick={exportMarks} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
            导出 JSON
          </button>
        )}
      </div>

      <div className="flex gap-2 pb-4">
        {(
          [
            ['all', `全部 ${notes.length + bookmarks.length}`],
            ['notes', `笔记 ${notes.length}`],
            ['bookmarks', `书签 ${bookmarks.length}`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              filter === k
                ? 'bg-indigo-700 text-white dark:bg-indigo-600'
                : 'border border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="pt-16 text-center text-sm text-stone-400">
          还没有内容。
          <br />
          读经文时点击某一节，即可加书签、写笔记。
          <div className="pt-4">
            <Link to="/books" className="text-indigo-600 underline dark:text-indigo-400">
              去读经 →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) =>
            item.kind === 'note' ? (
              <li key={item.data.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between text-xs">
                  <Link to={`/books/${item.data.bookId}/${item.data.chapter}`} className="font-semibold text-indigo-600 dark:text-indigo-400">
                    ✏️ {refText(item.data)}
                  </Link>
                  <span className="text-stone-400">{fmt(item.data.updatedAt)}</span>
                </div>
                <p className="font-scripture mt-2 border-l-2 border-stone-200 pl-3 text-sm leading-6 text-stone-500 dark:border-stone-700 dark:text-stone-400">
                  {item.data.verseText}
                </p>
                {editingId === item.data.id ? (
                  <div className="mt-2">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-stone-300 bg-transparent p-3 text-[15px] text-stone-800 outline-none focus:border-indigo-400 dark:border-stone-700 dark:text-stone-100"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg border border-stone-300 py-2 text-xs text-stone-500 dark:border-stone-700"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => {
                          updateNote(item.data.id, editText.trim());
                          setEditingId(null);
                        }}
                        className="flex-1 rounded-lg bg-indigo-700 py-2 text-xs font-medium text-white dark:bg-indigo-600"
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[15px] leading-7 whitespace-pre-wrap text-stone-800 dark:text-stone-100">{item.data.note}</p>
                )}
                <div className="mt-2 flex gap-3 text-xs">
                  {editingId !== item.data.id && (
                    <button
                      onClick={() => {
                        setEditingId(item.data.id);
                        setEditText(item.data.note);
                      }}
                      className="text-stone-400 underline"
                    >
                      编辑
                    </button>
                  )}
                  <button onClick={() => removeNote(item.data.id)} className="text-red-400 underline">
                    删除
                  </button>
                </div>
              </li>
            ) : (
              <li key={item.data.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="flex items-center justify-between text-xs">
                  <Link to={`/books/${item.data.bookId}/${item.data.chapter}`} className="font-semibold text-indigo-600 dark:text-indigo-400">
                    🔖 {refText(item.data)}
                  </Link>
                  <span className="text-stone-400">{fmt(item.data.createdAt)}</span>
                </div>
                <p className="font-scripture mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">{item.data.verseText}</p>
                <div className="mt-2 text-xs">
                  <button onClick={() => removeBookmark(item.data.id)} className="text-red-400 underline">
                    删除
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
