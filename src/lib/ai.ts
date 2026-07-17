/**
 * AI 灵修问答：本地检索相关经文（RAG 上下文）+ 调用服务端代理。
 * 对话记录仅存 localStorage，不上传服务器保存。
 */
import type { BibleIndex } from '../types/bible';
import { loadBook } from './bible';
import { createLocalStore } from './store';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  refs?: string[];
  at: number;
}

interface ChatState {
  messages: ChatMessage[];
}

export const chatStore = createLocalStore<ChatState>('lingxiu.chats.v1', { messages: [] });

export function addMessage(msg: Omit<ChatMessage, 'at'>) {
  chatStore.update((s) => ({ messages: [...s.messages, { ...msg, at: Date.now() }].slice(-100) }));
}

export function updateLastAssistant(content: string) {
  chatStore.update((s) => {
    const messages = [...s.messages];
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        messages[i] = { ...messages[i], content };
        break;
      }
    }
    return { messages };
  });
}

export function clearChat() {
  chatStore.set({ messages: [] });
}

/* ---------------- 本地经文检索（为主题式问题取 top N 相关经文） ---------------- */

const STOP = new Set([
  '我', '你', '他', '她', '它', '的', '了', '呢', '吗', '啊', '是', '在', '有', '和', '都', '也', '很', '最',
  '最', '什', '么', '怎', '样', '圣', '经', '怎', '说', '最', '近', '一', '个', '时', '候', '应', '该', '怎',
]);

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    if (![...g].some((c) => STOP.has(c))) out.push(g);
  }
  return out;
}

export interface RetrievedVerse {
  ref: string;
  text: string;
  score: number;
}

/** 在高收益书卷中检索与问题相关的经文（新约 + 诗篇/箴言/传道书/以赛亚书） */
const RAG_BOOKS = ['psa', 'pro', 'ecc', 'isa', 'jer', 'mat', 'mar', 'luk', 'joh', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'phi', 'col', '1th', '2th', '1ti', '2ti', 'tit', 'heb', 'jam', '1pe', '2pe', '1jo', 'rev'];

export async function retrieveContext(index: BibleIndex, question: string, topN = 8): Promise<RetrievedVerse[]> {
  const grams = bigrams(question.replace(/\s+/g, ''));
  const scores: RetrievedVerse[] = [];
  const books = index.books.filter((b) => RAG_BOOKS.includes(b.bookId));
  const loaded = await Promise.all(books.map((b) => loadBook(b.bookId).catch(() => null)));
  for (const book of loaded) {
    if (!book) continue;
    for (const ch of book.chapters) {
      for (const entry of ch.verses) {
        let score = 0;
        for (const g of grams) if (entry.t.includes(g)) score += 1;
        if (score > 0) {
          const ref = `${book.name} ${ch.chapter}:${entry.end ? `${entry.v}-${entry.end}` : entry.v}`;
          scores.push({ ref, text: entry.t, score });
        }
      }
    }
  }
  scores.sort((a, b) => b.score - a.score);
  // 去重（相邻同章只保留最高分）避免上下文冗余
  const seen = new Set<string>();
  const out: RetrievedVerse[] = [];
  for (const s of scores) {
    const key = s.ref.split(' ')[0] + s.ref.split(' ')[1]?.split(':')[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= topN) break;
  }
  return out;
}

/* ---------------- 服务端代理调用 ---------------- */

/** 问答端点：Vercel 部署时由 api/ask.js 提供（返回 JSON {answer}）；
 *  若改用 Cloudflare Worker（worker/ask.js）则返回 SSE 流，下方解析两种格式均兼容 */
export const ASK_ENDPOINT = '/api/ask';

export class AskNotConfiguredError extends Error {}

export interface AskRequest {
  question: string;
  context: RetrievedVerse[];
  passcode?: string;
}

/** 流式调用 /api/ask；未部署/未配置时抛 AskNotConfiguredError */
export async function askAI(req: AskRequest, onToken: (full: string) => void): Promise<string> {
  let res: Response;
  try {
    res = await fetch(ASK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch (e) {
    throw new AskNotConfiguredError('无法连接问答服务');
  }
  if (res.status === 404 || res.status === 405) throw new AskNotConfiguredError('问答服务未部署');
  if (res.status === 501) throw new AskNotConfiguredError('服务端未配置 API Key');
  if (res.status === 403) throw new Error('圈子口令不正确');
  if (res.status === 429) throw new Error('今日提问次数已用完，请明天再来');
  if (!res.ok) throw new Error(`服务异常（${res.status}），请稍后再试`);

  const contentType = res.headers.get('content-type') ?? '';
  // 本地 dev/preview 无 /api/ask，SPA fallback 会返回 index.html → 视为未部署
  if (contentType.includes('text/html')) throw new AskNotConfiguredError('问答服务未部署（本地开发默认无后端）');
  if (contentType.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content ?? '';
          full += delta;
          onToken(full);
        } catch {
          /* 忽略不完整分片 */
        }
      }
    }
    return full;
  }
  // 非流式回退
  const json = await res.json().catch(() => null);
  const text = json?.choices?.[0]?.message?.content ?? json?.answer ?? '';
  if (!text) throw new Error('服务返回内容为空');
  onToken(text);
  return text;
}
