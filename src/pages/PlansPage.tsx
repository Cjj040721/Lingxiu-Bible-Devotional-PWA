import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadBibleIndex } from '../lib/bible';
import {
  checkinStreak,
  completedCount,
  PLANS,
  planAssignments,
  planDayOfDate,
  planStore,
  rangesText,
  resetPlan,
  startPlan,
  stopPlan,
  toggleDay,
} from '../lib/plans';
import { useStore } from '../lib/store';
import type { BibleIndex } from '../types/bible';

/** 读经计划页：选择/切换计划、进度条、打卡日历 */
export default function PlansPage() {
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const planState = useStore(planStore);

  useEffect(() => {
    loadBibleIndex().then(setIndex).catch(() => {});
  }, []);

  const activePlan = planState.activePlanId ? PLANS.find((p) => p.id === planState.activePlanId) : undefined;

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 px-4 pt-6 pb-24 dark:bg-stone-950">
      <h1 className="pb-4 text-lg font-bold text-stone-800 dark:text-stone-100">读经计划</h1>

      {activePlan && index ? (
        <ActivePlan index={index} planId={activePlan.id} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-500 dark:text-stone-400">选择一个计划，开始每天的读经旅程：</p>
          {PLANS.map((p) => {
            const hasProgress = !!planState.progress[p.id];
            return (
              <div key={p.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
                <div className="font-semibold text-stone-800 dark:text-stone-100">{p.name}</div>
                <div className="mt-1 text-xs text-stone-400">{p.description}</div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => startPlan(p.id)}
                    className="rounded-xl bg-indigo-700 px-4 py-2 text-sm font-medium text-white dark:bg-indigo-600"
                  >
                    {hasProgress ? '继续这个计划' : '开始计划'}
                  </button>
                  <span className="text-xs text-stone-400">{p.days} 天</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivePlan({ index, planId }: { index: BibleIndex; planId: string }) {
  const planState = useStore(planStore);
  const [confirmReset, setConfirmReset] = useState(false);
  const plan = PLANS.find((p) => p.id === planId)!;
  const progress = planState.progress[planId];
  if (!progress) return null;

  const day = planDayOfDate(progress);
  const done = completedCount(progress);
  const streak = checkinStreak(progress);
  const assignments = planAssignments(plan, index);
  const pct = Math.round((done / plan.days) * 100);

  return (
    <div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-semibold text-stone-800 dark:text-stone-100">{plan.name}</div>
            <div className="mt-0.5 text-xs text-stone-400">
              开始于 {progress.startDate} · 第 {Math.min(day, plan.days)} 天
            </div>
          </div>
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-center dark:bg-amber-900/30">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{streak}</div>
            <div className="text-[10px] text-amber-500">连续天数</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
          <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-stone-400">
          <span>
            {done}/{plan.days} 天
          </span>
          <span>{pct}%</span>
        </div>
        {day <= plan.days && (
          <div className="mt-3 rounded-xl bg-indigo-50 p-3 text-sm dark:bg-indigo-950/50">
            <span className="text-stone-500 dark:text-stone-400">今日任务：</span>
            <span className="font-medium text-stone-800 dark:text-stone-100">
              {rangesText(assignments[day - 1], index)}
            </span>
            {!progress.completed[String(day)] && (
              <button
                onClick={() => toggleDay(planId, day)}
                className="ml-3 rounded-lg bg-indigo-700 px-3 py-1 text-xs font-medium text-white dark:bg-indigo-600"
              >
                打卡
              </button>
            )}
            {progress.completed[String(day)] && <span className="ml-2 text-xs text-emerald-600">✓ 已打卡</span>}
          </div>
        )}
        <div className="mt-3 flex gap-3 text-xs">
          <button onClick={() => stopPlan(planId)} className="text-stone-400 underline">
            更换计划
          </button>
          {confirmReset ? (
            <button
              onClick={() => {
                resetPlan(planId);
                setConfirmReset(false);
              }}
              className="text-red-500 underline"
            >
              确认从零重新开始？
            </button>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="text-stone-400 underline">
              重新开始
            </button>
          )}
        </div>
      </div>

      {/* 打卡日历：点击任意天可补打/取消 */}
      <h2 className="pt-5 pb-2 text-sm font-semibold text-stone-700 dark:text-stone-200">完成情况（点击格子可补打/取消）</h2>
      <div className="grid grid-cols-7 gap-1.5">
        {assignments.map((ranges, i) => {
          const d = i + 1;
          const isDone = !!progress.completed[String(d)];
          const isToday = d === day;
          return (
            <button
              key={d}
              onClick={() => toggleDay(planId, d)}
              title={rangesText(ranges, index)}
              className={`aspect-square rounded-lg text-[11px] font-medium transition ${
                isDone
                  ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                  : isToday
                    ? 'border-2 border-indigo-400 text-indigo-600 dark:text-indigo-300'
                    : 'bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>

      <p className="pt-4 text-center text-xs text-stone-400">
        错过的日子点格子补读即可，不必有压力 —— 坚持比完美更重要。
      </p>
      <div className="pt-2 text-center">
        <Link to="/books" className="text-sm text-indigo-600 underline dark:text-indigo-400">
          去读经 →
        </Link>
      </div>
    </div>
  );
}
