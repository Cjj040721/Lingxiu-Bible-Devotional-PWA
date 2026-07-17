import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dailyData from '../data/daily-verses.json';
import { loadBibleIndex } from '../lib/bible';
import { checkinStreak, completedCount, PLANS, planAssignments, planDayOfDate, planStore, rangesText, toggleDay } from '../lib/plans';
import { useStore } from '../lib/store';
import type { BibleIndex } from '../types/bible';

interface DailyVerse {
  bookId: string;
  chapter: number;
  v: number;
  end: number | null;
  ref: string;
  text: string;
}

/** 首页：每日金句 + 今日读经任务 + 入口 */
export default function HomePage() {
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const planState = useStore(planStore);

  useEffect(() => {
    loadBibleIndex().then(setIndex).catch(() => {});
  }, []);

  const verse: DailyVerse = useMemo(() => {
    const verses = (dailyData as { verses: DailyVerse[] }).verses;
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    return verses[dayOfYear % verses.length];
  }, []);

  const plan = planState.activePlanId ? PLANS.find((p) => p.id === planState.activePlanId) : undefined;

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 px-5 pt-10 pb-24 dark:bg-stone-950">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-700 text-xl text-white dark:bg-indigo-600">
          ✝
        </div>
        <div>
          <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100">灵修伴读</h1>
          <p className="text-xs text-stone-400">每天与神同行的一小段时光</p>
        </div>
      </header>

      {/* 每日金句 */}
      <Link
        to={`/books/${verse.bookId}/${verse.chapter}`}
        className="block rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-500 p-5 shadow-lg transition active:scale-[0.99] dark:from-indigo-800 dark:to-indigo-600"
      >
        <div className="mb-2 text-xs font-medium tracking-widest text-indigo-200">每日金句</div>
        <p className="font-scripture text-lg leading-relaxed text-white">{verse.text}</p>
        <div className="mt-3 text-right text-sm text-indigo-200">—— {verse.ref}</div>
      </Link>

      {/* 今日读经任务 */}
      {plan && index ? (
        <TodayCard index={index} planId={plan.id} />
      ) : (
        <Link
          to="/plans"
          className="mt-4 flex items-center justify-between rounded-2xl border border-dashed border-stone-300 bg-white p-4 transition active:scale-[0.99] dark:border-stone-700 dark:bg-stone-900"
        >
          <div>
            <div className="text-sm font-semibold text-stone-700 dark:text-stone-200">开始一个读经计划</div>
            <div className="mt-0.5 text-xs text-stone-400">一年整本 / 90 天新约 / 30 天福音书</div>
          </div>
          <span className="text-stone-300">→</span>
        </Link>
      )}

      {/* 开始读经 */}
      <Link
        to="/books"
        className="mt-4 flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 transition active:scale-[0.99] dark:border-stone-800 dark:bg-stone-900"
      >
        <div>
          <div className="text-sm font-semibold text-stone-700 dark:text-stone-200">开始读经</div>
          <div className="mt-0.5 text-xs text-stone-400">中文和合本 · 旧约 39 卷 · 新约 27 卷</div>
        </div>
        <span className="text-stone-300">→</span>
      </Link>

      <p className="mt-8 text-center text-xs text-stone-300 dark:text-stone-600">经文采用公有领域的中文和合本（1919）</p>
    </div>
  );
}

function TodayCard({ index, planId }: { index: BibleIndex; planId: string }) {
  const planState = useStore(planStore);
  const plan = PLANS.find((p) => p.id === planId)!;
  const progress = planState.progress[planId];
  if (!progress) return null;

  const day = planDayOfDate(progress);
  const finished = day > plan.days;
  const todayDone = !finished && !!progress.completed[String(day)];
  const ranges = !finished ? planAssignments(plan, index)[day - 1] : [];
  const streak = checkinStreak(progress);
  const done = completedCount(progress);
  const firstRange = ranges[0];

  return (
    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-stone-700 dark:text-stone-200">{plan.name}</div>
        <div className="text-xs text-stone-400">
          已连续 <span className="font-bold text-amber-600 dark:text-amber-400">{streak}</span> 天
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.round((done / plan.days) * 100)}%` }} />
      </div>
      <div className="mt-1 text-right text-[11px] text-stone-400">
        {done}/{plan.days} 天
      </div>

      {finished ? (
        <div className="mt-2 text-sm text-stone-600 dark:text-stone-300">🎉 计划已完成，愿神的话常存你心里。</div>
      ) : (
        <>
          <div className="mt-2 text-sm text-stone-600 dark:text-stone-300">
            今日（第 {day} 天）：<span className="font-medium text-stone-800 dark:text-stone-100">{rangesText(ranges, index)}</span>
          </div>
          <div className="mt-3 flex gap-2">
            {firstRange && (
              <Link
                to={`/books/${firstRange.bookId}/${firstRange.from}`}
                className="flex-1 rounded-xl bg-indigo-700 py-2.5 text-center text-sm font-medium text-white dark:bg-indigo-600"
              >
                去阅读
              </Link>
            )}
            <button
              onClick={() => toggleDay(planId, day)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition ${
                todayDone
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                  : 'border border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300'
              }`}
            >
              {todayDone ? '✓ 今日已打卡' : '打卡'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
