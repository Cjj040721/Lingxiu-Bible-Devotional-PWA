/**
 * 读经计划引擎 + 打卡进度存储
 * 计划章节切分：按卷顺序把章节平摊到各天（每天 base 或 base+1 章），确定性算法。
 */
import type { BibleIndex, BookMeta } from '../types/bible';
import { createLocalStore } from './store';

export interface ChapterRange {
  bookId: string;
  from: number;
  to: number;
}

export interface PlanDef {
  id: string;
  name: string;
  description: string;
  days: number;
  /** 从 66 卷索引中选取参与计划的卷 */
  pick: (books: BookMeta[]) => BookMeta[];
}

export const PLANS: PlanDef[] = [
  {
    id: 'whole-year',
    name: '一年读完整本圣经',
    description: '每天约 3-4 章，旧约新约按顺序通读',
    days: 365,
    pick: (books) => books,
  },
  {
    id: 'new-90',
    name: '90 天读完新约',
    description: '每天约 3 章，三个月读完新约 27 卷',
    days: 90,
    pick: (books) => books.filter((b) => b.testament === 'new'),
  },
  {
    id: 'gospel-30',
    name: '30 天福音书',
    description: '每天约 3 章，一个月读完四福音书（新手友好）',
    days: 30,
    pick: (books) => books.filter((b) => ['mat', 'mar', 'luk', 'joh'].includes(b.bookId)),
  },
];

/** 生成计划每日章节范围（缓存） */
const assignmentCache = new Map<string, ChapterRange[][]>();
export function planAssignments(plan: PlanDef, index: BibleIndex): ChapterRange[][] {
  const hit = assignmentCache.get(plan.id);
  if (hit) return hit;
  const books = plan.pick(index.books);
  const refs: { bookId: string; chapter: number }[] = [];
  for (const b of books) for (let c = 1; c <= b.chapters; c++) refs.push({ bookId: b.bookId, chapter: c });

  const total = refs.length;
  const base = Math.floor(total / plan.days);
  const rem = total - base * plan.days;
  const days: ChapterRange[][] = [];
  let i = 0;
  for (let d = 0; d < plan.days; d++) {
    const count = base + (d < rem ? 1 : 0);
    const slice = refs.slice(i, i + count);
    i += count;
    // 合并同卷连续章节为范围
    const ranges: ChapterRange[] = [];
    for (const r of slice) {
      const last = ranges[ranges.length - 1];
      if (last && last.bookId === r.bookId && last.to === r.chapter - 1) last.to = r.chapter;
      else ranges.push({ bookId: r.bookId, from: r.chapter, to: r.chapter });
    }
    days.push(ranges);
  }
  assignmentCache.set(plan.id, days);
  return days;
}

export function rangesText(ranges: ChapterRange[], index: BibleIndex): string {
  return ranges
    .map((r) => {
      const name = index.books.find((b) => b.bookId === r.bookId)?.name ?? r.bookId;
      return r.from === r.to ? `${name} 第${r.from}章` : `${name} ${r.from}-${r.to}章`;
    })
    .join('；');
}

/** 进度存储结构 */
export interface PlanProgress {
  startDate: string; // YYYY-MM-DD（本地）
  completed: Record<string, string>; // 计划第几天 -> 完成日期 YYYY-MM-DD
}
interface PlanState {
  activePlanId: string | null;
  progress: Record<string, PlanProgress>;
}
export const planStore = createLocalStore<PlanState>('lingxiu.plan.v1', {
  activePlanId: null,
  progress: {},
});

export function todayStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 今天处于计划第几天（1-based）；开始前返回 ≤0 */
export function planDayOfDate(progress: PlanProgress, date = new Date()): number {
  const diff = Math.floor((parseLocal(todayStr(date)).getTime() - parseLocal(progress.startDate).getTime()) / 86400000);
  return diff + 1;
}

export function startPlan(planId: string) {
  planStore.update((s) => ({
    activePlanId: planId,
    progress: {
      ...s.progress,
      [planId]: s.progress[planId] ?? { startDate: todayStr(), completed: {} },
    },
  }));
}

export function stopPlan(planId: string) {
  planStore.update((s) => ({ ...s, activePlanId: s.activePlanId === planId ? null : s.activePlanId }));
}

export function resetPlan(planId: string) {
  planStore.update((s) => ({
    ...s,
    progress: { ...s.progress, [planId]: { startDate: todayStr(), completed: {} } },
  }));
}

export function toggleDay(planId: string, day: number) {
  planStore.update((s) => {
    const p = s.progress[planId];
    if (!p) return s;
    const completed = { ...p.completed };
    if (completed[String(day)]) delete completed[String(day)];
    else completed[String(day)] = todayStr();
    return { ...s, progress: { ...s.progress, [planId]: { ...p, completed } } };
  });
}

/** 连续打卡天数（按自然日，今天或昨天结尾） */
export function checkinStreak(progress: PlanProgress | undefined): number {
  if (!progress) return 0;
  const dates = new Set(Object.values(progress.completed));
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(todayStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function completedCount(progress: PlanProgress | undefined): number {
  return progress ? Object.keys(progress.completed).length : 0;
}

/** 当前章节是否属于今日任务且未完成（供阅读页显示打卡按钮） */
export function isTodayAssignment(
  index: BibleIndex,
  plan: PlanDef,
  progress: PlanProgress,
  bookId: string,
  chapter: number,
): boolean {
  const day = planDayOfDate(progress);
  if (day < 1 || day > plan.days) return false;
  if (progress.completed[String(day)]) return false;
  return planAssignments(plan, index)[day - 1].some(
    (r) => r.bookId === bookId && chapter >= r.from && chapter <= r.to,
  );
}
