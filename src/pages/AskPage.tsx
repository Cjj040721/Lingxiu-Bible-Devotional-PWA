import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addMessage,
  askAI,
  AskNotConfiguredError,
  chatStore,
  clearChat,
  retrieveContext,
  updateLastAssistant,
} from '../lib/ai';
import { loadBibleIndex } from '../lib/bible';
import { useStore } from '../lib/store';
import type { BibleIndex } from '../types/bible';

const QUICK_PROMPTS = [
  '我最近很焦虑，圣经怎么说？',
  '我不知道该读哪卷书',
  '给我一句安慰的话',
  '工作压力大的时候怎么办？',
  '圣经怎样讲婚姻？',
  '如何为孩子祷告？',
];

const DISCLAIMER = 'AI 回答仅供参考，重要问题请与牧者/传道人交通';

/** AI 灵修问答页（对话记录仅存本地） */
export default function AskPage() {
  const { messages } = useStore(chatStore);
  const [index, setIndex] = useState<BibleIndex | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [passcode, setPasscode] = useState(() => localStorage.getItem('lingxiu.ask.passcode') ?? '');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadBibleIndex().then(setIndex).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy || !index) return;
    setInput('');
    setBusy(true);
    addMessage({ role: 'user', content: q });
    try {
      const context = await retrieveContext(index, q);
      localStorage.setItem('lingxiu.ask.passcode', passcode);
      addMessage({ role: 'assistant', content: '…', refs: context.map((c) => c.ref) });
      const answer = await askAI({ question: q, context, passcode: passcode || undefined }, (full) =>
        updateLastAssistant(full),
      );
      updateLastAssistant(answer + `\n\n———\n${DISCLAIMER}`);
    } catch (e) {
      if (e instanceof AskNotConfiguredError) {
        updateLastAssistant(
          `🕊️ AI 问答功能还未配置完成。\n\n需要部署者在服务端配置大模型 API Key 后才能使用（见 README「配置 AI 问答」）。配置好后，你可以问我诸如「我最近很焦虑，圣经怎么说」这类问题，我会依据经文和公有领域注解来回答。`,
        );
      } else {
        updateLastAssistant(`出错了：${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-stone-50 dark:bg-stone-950">
      <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
        <h1 className="text-lg font-bold text-stone-800 dark:text-stone-100">AI 灵修问答</h1>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-stone-400 underline">
            清空对话
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-40">
        {messages.length === 0 && (
          <div>
            <p className="pt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
              可以问我经文含义，也可以告诉我你的处境（如「我最近很焦虑」），我会依据圣经原文与公有领域注解回答，并标注出处。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full border border-stone-300 bg-white px-3.5 py-2 text-xs text-stone-600 transition active:scale-95 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-stone-100 p-3 text-xs leading-5 text-stone-400 dark:bg-stone-900 dark:text-stone-500">
              对话记录只保存在你的设备上，不会上传服务器留存。{DISCLAIMER}。
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-700 text-white dark:bg-indigo-600'
                  : 'border border-stone-200 bg-white text-stone-800 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100'
              }`}
            >
              {m.content}
              {m.role === 'assistant' && m.refs && m.refs.length > 0 && m.content !== '…' && (
                <div className="mt-2 border-t border-stone-100 pt-2 dark:border-stone-800">
                  <div className="text-xs text-stone-400">参考经文：</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.refs.map((r) => {
                      const [bookName, chapVerse] = r.split(' ');
                      const bookId = index?.books.find((b) => b.name === bookName)?.bookId;
                      const chapter = chapVerse?.split(':')[0];
                      return bookId && chapter ? (
                        <Link
                          key={r}
                          to={`/books/${bookId}/${chapter}`}
                          className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          {r}
                        </Link>
                      ) : (
                        <span key={r} className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-500 dark:bg-stone-800">
                          {r}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 输入区（固定在 TabBar 之上） */}
      <div className="fixed inset-x-0 bottom-[57px] z-10 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto max-w-lg px-4 py-2.5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder="今天想交通点什么？"
              disabled={busy}
              className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-[15px] text-stone-800 outline-none focus:border-indigo-400 disabled:opacity-60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <button
              onClick={() => send(input)}
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-indigo-600"
            >
              {busy ? '…' : '发送'}
            </button>
          </div>
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="圈子口令（如部署者开启则需要）"
            type="password"
            className="mt-2 w-full rounded-lg border border-stone-200 bg-transparent px-3 py-1.5 text-xs text-stone-500 outline-none focus:border-indigo-300 dark:border-stone-800 dark:text-stone-400"
          />
        </div>
      </div>
    </div>
  );
}
