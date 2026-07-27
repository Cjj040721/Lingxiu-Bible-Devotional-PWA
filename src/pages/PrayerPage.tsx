import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAmbientKind,
  getAmbientVolume,
  playChime,
  setAmbientVolume,
  stopAmbient,
  toggleAmbient,
  type AmbientKind,
} from '../lib/ambient';
import {
  addPrayerItem,
  CLASSIC_PRAYERS,
  comfortVerseOfToday,
  PRAYER_THEMES,
  prayerStore,
  removePrayerItem,
  togglePrayerAnswered,
} from '../lib/prayer';
import { useStore } from '../lib/store';

type Tab = 'guide' | 'timer' | 'list';

const TABS: Array<[Tab, string]> = [
  ['guide', '祷告引导'],
  ['timer', '计时祷告'],
  ['list', '代祷清单'],
];

/** 祷告页：提示词引导 + 经典祷文 / 计时器 + 氛围音 / 代祷事项清单 */
export default function PrayerPage() {
  const [tab, setTab] = useState<Tab>('guide');

  // 离开祷告页时自动停止氛围音
  useEffect(() => () => stopAmbient(), []);

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-stone-50 px-4 pt-6 pb-24 dark:bg-stone-950">
      <header className="pb-4">
        <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100">祷告 🙏</h1>
        <p className="mt-0.5 text-xs text-stone-400">不住地祷告，凡事谢恩</p>
      </header>

      <div className="flex gap-2 pb-4">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              tab === k
                ? 'bg-indigo-700 text-white dark:bg-indigo-600'
                : 'border border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'guide' && <GuideSection />}
      {tab === 'timer' && <TimerSection />}
      {tab === 'list' && <ListSection />}
    </div>
  );
}

/* ---------------- 祷告引导：提示词主题 + 经典祷文 ---------------- */

function GuideSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-400">不知道说什么时，选一个主题，跟着提纲慢慢开口。</p>
      {PRAYER_THEMES.map((t) => {
        const open = openId === t.id;
        return (
          <div key={t.id} className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <button onClick={() => setOpenId(open ? null : t.id)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                {t.icon} {t.title}
              </span>
              <span className="text-stone-300 dark:text-stone-600">{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div className="border-t border-stone-100 px-4 pt-3 pb-4 dark:border-stone-800">
                <ol className="space-y-1.5 text-sm leading-6 text-stone-600 dark:text-stone-300">
                  {t.guides.map((g, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-medium text-amber-600 dark:text-amber-400">{i + 1}.</span>
                      {g}
                    </li>
                  ))}
                </ol>
                {t.verses.map((v) => (
                  <Link
                    key={v.ref}
                    to={`/books/${v.bookId}/${v.chapter}`}
                    className="mt-3 block rounded-xl bg-stone-50 p-3 transition active:scale-[0.99] dark:bg-stone-800/60"
                  >
                    <p className="font-scripture text-sm leading-6 text-stone-600 dark:text-stone-300">{v.text}</p>
                    <div className="mt-1 text-right text-xs text-indigo-600 dark:text-indigo-400">—— {v.ref} →</div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <h2 className="pt-3 text-sm font-semibold text-stone-700 dark:text-stone-200">经典祷文</h2>
      {CLASSIC_PRAYERS.map((p) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <button onClick={() => setOpenId(open ? null : p.id)} className="flex w-full items-center justify-between p-4 text-left">
              <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">{p.title}</span>
              <span className="text-xs text-stone-400">{open ? '−' : p.source}</span>
            </button>
            {open && (
              <div className="border-t border-stone-100 px-4 pt-3 pb-4 dark:border-stone-800">
                <div className="mb-2 text-xs text-stone-400">{p.source}</div>
                {p.paragraphs.map((line, i) => (
                  <p key={i} className="font-scripture py-1 text-[15px] leading-7 text-stone-700 dark:text-stone-200">
                    {line}
                  </p>
                ))}
                {p.link && (
                  <Link to={`/books/${p.link.bookId}/${p.link.chapter}`} className="mt-2 inline-block text-xs text-indigo-600 underline dark:text-indigo-400">
                    阅读整章 →
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- 计时祷告：倒计时 + 氛围音 ---------------- */

const DURATIONS = [5, 10, 15]; // 分钟

function TimerSection() {
  const [minutes, setMinutes] = useState(10);
  const [remaining, setRemaining] = useState<number | null>(null); // 剩余秒数；null = 未开始
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const endAtRef = useRef(0);

  // 用时间戳计算剩余，避免后台计时不准
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((endAtRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        setRunning(false);
        setFinished(true);
        stopAmbient();
        playChime();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const total = minutes * 60;
  const left = remaining ?? total;
  const progress = remaining === null ? 0 : 1 - left / total;

  const start = () => {
    endAtRef.current = Date.now() + (remaining ?? total) * 1000;
    setFinished(false);
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false);
    setRemaining(null);
    setFinished(false);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  // 进度圆环参数
  const R = 88;
  const C = 2 * Math.PI * R;

  const comfort = useMemo(comfortVerseOfToday, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        {/* 时长选择 */}
        <div className="flex justify-center gap-2 pb-4">
          {DURATIONS.map((m) => (
            <button
              key={m}
              disabled={running}
              onClick={() => {
                setMinutes(m);
                reset();
              }}
              className={`rounded-full px-4 py-1.5 text-xs transition disabled:opacity-50 ${
                minutes === m
                  ? 'bg-indigo-700 text-white dark:bg-indigo-600'
                  : 'border border-stone-300 text-stone-500 dark:border-stone-700 dark:text-stone-400'
              }`}
            >
              {m} 分钟
            </button>
          ))}
        </div>

        {/* 倒计时圆环 */}
        <div className="relative mx-auto h-52 w-52">
          <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
            <circle cx="100" cy="100" r={R} fill="none" strokeWidth="8" className="stroke-stone-100 dark:stroke-stone-800" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              className="stroke-indigo-500 transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-bold tabular-nums text-stone-800 dark:text-stone-100">
              {mm}:{ss}
            </span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex gap-2 pt-4">
          {running ? (
            <button onClick={pause} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-medium text-white">
              暂停
            </button>
          ) : (
            <button onClick={start} className="flex-1 rounded-xl bg-indigo-700 py-2.5 text-sm font-medium text-white dark:bg-indigo-600">
              {remaining !== null && !finished ? '继续' : '开始祷告'}
            </button>
          )}
          <button
            onClick={reset}
            className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300"
          >
            重置
          </button>
        </div>
      </div>

      <AmbientCard />

      {/* 计时结束的安慰经文 */}
      {finished && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-700 to-indigo-500 p-5 shadow-lg dark:from-indigo-800 dark:to-indigo-600">
          <div className="mb-2 text-xs font-medium tracking-widest text-indigo-200">祷告完成，愿这节经文安慰你</div>
          <p className="font-scripture text-lg leading-relaxed text-white">{comfort.text}</p>
          <Link to={`/books/${comfort.bookId}/${comfort.chapter}`} className="mt-3 block text-right text-sm text-indigo-200 underline">
            —— {comfort.ref} →
          </Link>
        </div>
      )}
    </div>
  );
}

/** 氛围音卡片：音景开关 + 音量 */
function AmbientCard() {
  const [kind, setKind] = useState<AmbientKind | null>(getAmbientKind());
  const [vol, setVol] = useState(getAmbientVolume());

  const sounds: Array<[AmbientKind, string, string]> = [
    ['rain', '🌧️', '细雨'],
    ['pad', '🎵', '安静垫音'],
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="pb-3 text-sm font-semibold text-stone-700 dark:text-stone-200">背景氛围音</div>
      <div className="flex gap-2">
        {sounds.map(([k, icon, label]) => (
          <button
            key={k}
            onClick={() => setKind(toggleAmbient(k) ? k : null)}
            className={`flex-1 rounded-xl py-2.5 text-sm transition ${
              kind === k
                ? 'bg-indigo-700 font-medium text-white dark:bg-indigo-600'
                : 'border border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-300'
            }`}
          >
            {icon} {label}
            {kind === k && <span className="ml-1 text-xs">· 播放中</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 pt-3">
        <span className="text-xs text-stone-400">音量</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(vol * 100)}
          onChange={(e) => {
            const v = Number(e.target.value) / 100;
            setVol(v);
            setAmbientVolume(v);
          }}
          className="flex-1 accent-indigo-600"
        />
      </div>
    </div>
  );
}

/* ---------------- 代祷事项清单 ---------------- */

function ListSection() {
  const { items } = useStore(prayerStore);
  const [text, setText] = useState('');

  const pending = items.filter((i) => !i.answeredAt);
  const answered = items.filter((i) => i.answeredAt);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    addPrayerItem(v);
    setText('');
  };

  const renderItem = (i: (typeof items)[number]) => (
    <li key={i.id} className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between text-xs text-stone-400">
        <span>{fmt(i.createdAt)}</span>
        {i.answeredAt && <span className="font-medium text-emerald-600 dark:text-emerald-400">✅ {fmt(i.answeredAt)} 已应允</span>}
      </div>
      <p className={`mt-1.5 text-[15px] leading-7 whitespace-pre-wrap ${i.answeredAt ? 'text-stone-400 dark:text-stone-500' : 'text-stone-800 dark:text-stone-100'}`}>
        {i.content}
      </p>
      <div className="mt-2 flex gap-3 text-xs">
        <button onClick={() => togglePrayerAnswered(i.id)} className="text-stone-400 underline">
          {i.answeredAt ? '取消应允' : '标记已应允 ✅'}
        </button>
        <button onClick={() => removePrayerItem(i.id)} className="text-red-400 underline">
          删除
        </button>
      </div>
    </li>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="写下一件代祷事项…"
          className="flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none focus:border-indigo-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
        />
        <button onClick={submit} className="rounded-xl bg-indigo-700 px-4 text-sm font-medium text-white dark:bg-indigo-600">
          添加
        </button>
      </div>

      {items.length === 0 ? (
        <div className="pt-16 text-center text-sm text-stone-400">
          还没有代祷事项。
          <br />
          把牵挂的人与事写下来，常常为他们祷告。
        </div>
      ) : (
        <>
          <ul className="space-y-3">{pending.map(renderItem)}</ul>
          {answered.length > 0 && (
            <>
              <h2 className="pt-3 text-sm font-semibold text-stone-700 dark:text-stone-200">已应允 ✅（{answered.length}）</h2>
              <ul className="space-y-3">{answered.map(renderItem)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
