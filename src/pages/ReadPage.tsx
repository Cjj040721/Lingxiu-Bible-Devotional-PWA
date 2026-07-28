import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import VerseActionSheet, { type SelectedVerse } from '../components/VerseActionSheet';
import VerseCardModal from '../components/VerseCardModal';
import { adjacentChapter, findBookMeta, loadBibleIndex, loadBook, verseLabel, type ChapterRef } from '../lib/bible';
import { loadCommentary, loadVerseNotes, type CommentaryBook, type VerseNotesBook } from '../lib/commentary';
import { refText } from '../lib/marks';
import { isTodayAssignment, PLANS, planDayOfDate, planStore, toggleDay } from '../lib/plans';
import { FONT_SIZES, useSettings } from '../lib/settings';
import { useStore } from '../lib/store';
import type { BibleIndex, BookData, VerseEntry } from '../types/bible';

/** 经文阅读页（核心页面）：阅读 + 选节操作 + 注解 + 打卡 */
export default function ReadPage() {
  const { bookId = '', chapter: chapterParam = '1' } = useParams();
  const chapter = Math.max(1, parseInt(chapterParam, 10) || 1);
  const navigate = useNavigate();
  const { settings, setFontSizeLevel, toggleNightMode } = useSettings();

  const [index, setIndex] = useState<BibleIndex | null>(null);
  const [book, setBook] = useState<BookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedVerse | null>(null);
  const [cardVerse, setCardVerse] = useState<SelectedVerse | null>(null);
  const [showCommentary, setShowCommentary] = useState(false);
  const [commentary, setCommentary] = useState<CommentaryBook | null | undefined>(undefined);
  const [verseNotes, setVerseNotes] = useState<VerseNotesBook | null | undefined>(undefined);
  // 逐节注解开关（注解内联显示在对应经文下方），状态持久化到 localStorage
  const [verseNotesOn, setVerseNotesOn] = useState(() => localStorage.getItem('lingxiu.read.verseNotes') === '1');
  const toggleVerseNotes = () => {
    setVerseNotesOn((v) => {
      localStorage.setItem('lingxiu.read.verseNotes', v ? '0' : '1');
      return !v;
    });
  };

  const planState = useStore(planStore);

  // 加载索引 + 当前卷数据
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setBook(null);
    setSelected(null);
    setShowCommentary(false);
    setCommentary(undefined);
    setVerseNotes(undefined);
    Promise.all([loadBibleIndex(), loadBook(bookId)])
      .then(([idx, bk]) => {
        if (cancelled) return;
        if (!findBookMeta(idx, bookId)) {
          setError('not-found');
          return;
        }
        setIndex(idx);
        setBook(bk);
      })
      .catch((e) => !cancelled && setError(String(e)));
    // 注解随卷一起加载（loadCommentary 内部有 Promise 缓存，底部「本章注解」复用同一份）
    loadCommentary(bookId).then((c) => !cancelled && setCommentary(c));
    // 逐节简注同步加载（没有该文件的卷返回 null，内联回退到 MHCC 节段）
    loadVerseNotes(bookId).then((v) => !cancelled && setVerseNotes(v));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 展开注解时按需加载（通常随卷加载已完成，这里是兜底）
  useEffect(() => {
    if (showCommentary && commentary === undefined) {
      loadCommentary(bookId).then(setCommentary);
    }
  }, [showCommentary, commentary, bookId]);

  const meta = index ? findBookMeta(index, bookId) : undefined;
  const chapterData = book?.chapters[chapter - 1];

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [bookId, chapter]);

  // 逐节注解映射：优先逐节简注（每节一条），没有该数据的书卷回退到 MHCC 节段
  // 统一挂到「覆盖该节」的经文条目上（key = 条目起始节号）；label 为 null 表示逐节简注
  const inlineNotes = useMemo(() => {
    const map = new Map<number, { label: string | null; text: string }[]>();
    if (!verseNotesOn || !chapterData) return map;
    const attach = (v: number, item: { label: string | null; text: string }) => {
      const entry = chapterData.verses.find((e) => v >= e.v && v <= (e.end ?? e.v));
      const key = entry?.v ?? chapterData.verses[chapterData.verses.length - 1]?.v;
      if (key == null) return;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    };
    const vnChapter = verseNotes?.chapters.find((c) => c.chapter === chapter);
    if (vnChapter) {
      for (const n of vnChapter.notes) attach(n.v, { label: null, text: n.note });
      return map;
    }
    const commentaryChapter = commentary?.chapters.find((c) => c.chapter === chapter);
    if (!commentaryChapter) return map;
    for (const s of commentaryChapter.sections) {
      const m = s.verses.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      const endV = parseInt(m[2] ?? m[1], 10);
      attach(endV, { label: `📜 ${chapter}章${s.verses}节 · 注解`, text: s.text });
    }
    return map;
  }, [verseNotesOn, verseNotes, commentary, chapterData, chapter]);

  const prev: ChapterRef | null = index ? adjacentChapter(index, bookId, chapter, 'prev') : null;
  const next: ChapterRef | null = index ? adjacentChapter(index, bookId, chapter, 'next') : null;
  const go = (ref: ChapterRef | null) => {
    if (ref) navigate(`/books/${ref.bookId}/${ref.chapter}`);
  };

  // 左右滑动翻章
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 64) return;
    if (dx < 0) go(next);
    else go(prev);
  };

  const fontSize = FONT_SIZES[settings.fontSizeLevel];
  const bookName = meta?.name ?? book?.name ?? '';
  const title = useMemo(() => (bookName ? `${bookName} 第${chapter}章` : ''), [bookName, chapter]);

  // 今日打卡：当前章节属于进行中的计划今日任务且未完成
  const activePlan = planState.activePlanId ? PLANS.find((p) => p.id === planState.activePlanId) : undefined;
  const progress = activePlan ? planState.progress[activePlan.id] : undefined;
  const canCheckinToday =
    !!index && !!activePlan && !!progress && isTodayAssignment(index, activePlan, progress, bookId, chapter);
  const [checkinToast, setCheckinToast] = useState(false);

  const pickVerse = (entry: VerseEntry) => {
    if (!book) return;
    setSelected({
      bookId,
      bookName: book.name,
      chapter,
      v: entry.v,
      end: entry.end,
      text: entry.t,
    });
  };

  if (error === 'not-found') {
    return (
      <Centered>
        <p>没有找到这卷书。</p>
        <Link className="mt-3 inline-block text-indigo-600 underline" to="/books">
          返回卷列表
        </Link>
      </Centered>
    );
  }
  if (error) return <Centered>数据加载失败：{error}</Centered>;
  if (!book || !meta) return <Centered>正在加载经文…</Centered>;
  if (!chapterData) {
    return (
      <Centered>
        <p>
          {bookName} 只有 {book.chapters.length} 章。
        </p>
        <Link className="mt-3 inline-block text-indigo-600 underline" to={`/books/${bookId}`}>
          返回章节目录
        </Link>
      </Centered>
    );
  }

  const commentaryChapter = commentary?.chapters.find((c) => c.chapter === chapter);
  const verseNotesChapter = verseNotes?.chapters.find((c) => c.chapter === chapter);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl bg-stone-50 dark:bg-stone-950" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* 顶部：位置 + 阅读设置 */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="flex items-center gap-2 px-4 py-3">
          <Link to={`/books/${bookId}`} className="shrink-0 text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-200" aria-label="返回章节目录">
            ←
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold text-stone-800 dark:text-stone-100">{title}</h1>
          {(commentaryChapter || verseNotesChapter) && (
            <button
              onClick={toggleVerseNotes}
              className={`shrink-0 rounded-full px-2.5 py-1.5 text-sm font-medium transition ${
                verseNotesOn
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/60 dark:text-indigo-300'
                  : 'text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
              }`}
              aria-label={verseNotesOn ? '关闭逐节注解' : '开启逐节注解'}
              title="逐节注解"
            >
              注
            </button>
          )}
          <button
            onClick={toggleNightMode}
            className="shrink-0 rounded-full p-2 text-lg text-stone-500 transition hover:bg-stone-200 dark:text-stone-300 dark:hover:bg-stone-800"
            aria-label={settings.nightMode ? '切换到日间模式' : '切换到夜间模式'}
          >
            {settings.nightMode ? '☀️' : '🌙'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-3 pb-2">
          <button
            onClick={() => setFontSizeLevel(settings.fontSizeLevel - 1)}
            disabled={settings.fontSizeLevel === 0}
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-600 transition disabled:opacity-30 dark:border-stone-700 dark:text-stone-300"
            aria-label="减小字号"
          >
            A−
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {FONT_SIZES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-6 rounded-full ${i <= settings.fontSizeLevel ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-stone-300 dark:bg-stone-700'}`}
              />
            ))}
          </div>
          <button
            onClick={() => setFontSizeLevel(settings.fontSizeLevel + 1)}
            disabled={settings.fontSizeLevel === FONT_SIZES.length - 1}
            className="rounded-lg border border-stone-300 px-3 py-1 text-sm text-stone-600 transition disabled:opacity-30 dark:border-stone-700 dark:text-stone-300"
            aria-label="增大字号"
          >
            A＋
          </button>
        </div>
      </header>

      {/* 今日打卡条 */}
      {canCheckinToday && activePlan && (
        <div className="sticky top-[89px] z-10 mx-4 mt-2 flex items-center justify-between rounded-xl bg-amber-50 px-4 py-2.5 text-sm shadow-sm dark:bg-amber-950/60">
          <span className="text-amber-700 dark:text-amber-300">本章属于今日读经任务（{activePlan.name}）</span>
          <button
            onClick={() => {
              const p = planStore.get().progress[activePlan.id];
              if (p) {
                toggleDay(activePlan.id, planDayOfDate(p));
                setCheckinToast(true);
                setTimeout(() => setCheckinToast(false), 1500);
              }
            }}
            className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white"
          >
            {checkinToast ? '✓ 已打卡' : '打卡'}
          </button>
        </div>
      )}

      {/* 经文 */}
      <main className="px-5 pt-5 pb-28">
        <div className="font-scripture text-stone-800 dark:text-stone-200" style={{ fontSize, lineHeight: 2 }}>
          {chapterData.verses.map((entry) => (
            <Fragment key={entry.v}>
              <p
                onClick={() => pickVerse(entry)}
                className={`mb-1 cursor-pointer rounded-lg px-1.5 -mx-1.5 transition-colors ${
                  selected && selected.chapter === chapter && selected.v === entry.v
                    ? 'bg-indigo-100/70 dark:bg-indigo-900/40'
                    : 'active:bg-stone-100 dark:active:bg-stone-900'
                }`}
              >
                <sup className="mr-1.5 font-sans text-[0.62em] font-semibold text-indigo-500 select-none dark:text-indigo-400">
                  {verseLabel(entry)}
                </sup>
                {entry.t}
              </p>
              {/* 逐节注解：内联显示在对应经文下方（逐节简注 / MHCC 节段） */}
              {inlineNotes.get(entry.v)?.map((n, i) =>
                n.label ? (
                  <div
                    key={i}
                    className="mb-3 ml-5 rounded-lg border-l-2 border-indigo-200 bg-stone-100/70 px-3 py-2 dark:border-indigo-800 dark:bg-stone-900/60"
                  >
                    <div className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">{n.label}</div>
                    <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{n.text}</p>
                  </div>
                ) : (
                  <p
                    key={i}
                    className="mb-2 ml-5 border-l-2 border-indigo-100 pl-2.5 text-sm leading-6 text-stone-500 dark:border-indigo-900 dark:text-stone-400"
                  >
                    {n.text}
                  </p>
                ),
              )}
            </Fragment>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-stone-400 dark:text-stone-600">—— {bookName} 第{chapter}章 完 ——</p>

        {/* 注解区（公有领域释经资料，按需加载） */}
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
          <button
            onClick={() => setShowCommentary((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-stone-600 dark:text-stone-300"
          >
            <span>📜 本章注解</span>
            <span className="text-stone-400">{showCommentary ? '收起 ▲' : '展开 ▼'}</span>
          </button>
          {showCommentary && (
            <div className="border-t border-stone-100 px-4 py-3 dark:border-stone-800">
              {commentary === undefined ? (
                <p className="py-3 text-center text-sm text-stone-400">正在加载注解…</p>
              ) : !commentary || !commentaryChapter ? (
                <p className="py-3 text-center text-sm leading-6 text-stone-400">
                  本卷注解整理中。
                  <br />
                  <span className="text-xs">（计划收录马太亨利等公有领域释经资料，新约与诗篇优先）</span>
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-stone-400">资料来源：{commentary.source}（公有领域）</div>
                  {commentaryChapter.sections.map((s, i) => (
                    <div key={i}>
                      <div className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                        {chapter}章{s.verses}节
                      </div>
                      <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-300">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 底部：上一章 / 目录 / 下一章 */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-stone-50/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto flex max-w-2xl items-stretch gap-2 px-4 py-3">
          <NavButton disabled={!prev} onClick={() => go(prev)}>
            ← 上一章
          </NavButton>
          <Link
            to={`/books/${bookId}`}
            className="flex flex-1 items-center justify-center rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-600 transition active:scale-[0.98] dark:border-stone-700 dark:text-stone-300"
          >
            目录
          </Link>
          <NavButton disabled={!next} onClick={() => go(next)}>
            下一章 →
          </NavButton>
        </div>
      </nav>

      {/* 选节操作 + 分享卡片 */}
      <VerseActionSheet verse={selected} onClose={() => setSelected(null)} onShareCard={setCardVerse} />
      {cardVerse && (
        <VerseCardModal text={cardVerse.text} refLabel={refText(cardVerse)} onClose={() => setCardVerse(null)} />
      )}
    </div>
  );
}

function NavButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-xl bg-indigo-700 py-2.5 text-sm font-medium text-white transition enabled:active:scale-[0.98] disabled:bg-stone-300 disabled:text-stone-500 dark:bg-indigo-600 dark:disabled:bg-stone-800 dark:disabled:text-stone-600"
    >
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-stone-50 px-6 text-center text-sm text-stone-500 dark:bg-stone-950 dark:text-stone-400">
      {children}
    </div>
  );
}
