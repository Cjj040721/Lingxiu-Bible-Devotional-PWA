/**
 * 灵修伴读 · AI 灵修问答代理（Vercel Serverless Function，Node.js runtime）
 *
 * 职责：
 *  1. 隐藏大模型 API Key（只存 Vercel 环境变量，绝不下发前端）
 *  2. 圈子口令校验（可选，防止链接外传后被公开使用）
 *  3. 简易限流（每 IP 每天 20 次；serverless 实例间不共享计数，严格限流建议接 Vercel KV/Upstash）
 *  4. 拼接 RAG Prompt：系统指令 + 前端检索到的经文上下文 + 用户问题
 *
 * 环境变量（Vercel 项目后台配置）：
 *  OPENAI_API_KEY   必填，OpenAI 兼容接口的 Key（DeepSeek 在 platform.deepseek.com 申请）
 *  OPENAI_BASE_URL  可选，默认 https://api.deepseek.com/v1
 *  MODEL            可选，默认 deepseek-chat
 *  PASSCODE         可选，圈子口令；设置后前端必须带正确口令
 *  DAILY_LIMIT      可选，每 IP 每天限次，默认 20
 *
 * 请求：POST /api/ask  { question, context: [{ref,text}], passcode? }
 * 响应：application/json { answer } —— 稳妥起见采用非流式一次性返回
 *       （前端 src/lib/ai.ts 同时兼容 SSE 流与 JSON 两种格式）
 * 未配置 Key：501；口令错误：403；超限：429
 */

export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `你是「灵修伴读」的灵修问答助手，为基督徒小圈子服务。规则：
1. 你只能依据：① 中文和合本圣经原文 ② 提供的公有领域注解资料 来回答，不得凭空编造经文或出处。
2. 回答中引用经文时必须标注出处（书卷 章:节），引用要准确。
3. 保持温和福音派基调；遇到有争议的教义（如预定论、灵恩等），不站队，呈现多方观点。
4. 语气像一位稳妥的同工：先同理提问者的处境，再用经文回应。
5. 回答控制在 300 字以内，分小段，便于手机阅读。
6. 回答末尾必须固定附上：「AI 回答仅供参考，重要问题请与牧者/传道人交通。」
7. 若问题与信仰/圣经无关，礼貌地引导回圣经与灵修话题。`;

// 简易内存限流（同一 serverless 实例内有效）
const rateMap = new Map();
function checkRate(ip, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${day}`;
  const count = (rateMap.get(key) ?? 0) + 1;
  rateMap.set(key, count);
  if (rateMap.size > 10000) rateMap.clear();
  return count <= limit;
}

function buildMessages({ question, context }) {
  const ctxText = (context ?? [])
    .slice(0, 10)
    .map((c) => `【${c.ref}】${c.text}`)
    .join('\n');
  const userContent = ctxText
    ? `以下是与问题相关的经文（和检索到的注解资料），请优先依据它们回答：\n${ctxText}\n\n我的问题：${question}`
    : `我的问题：${question}`;
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(501).json({ error: 'AI not configured: OPENAI_API_KEY missing' });
  }

  const body = req.body ?? {};
  if (!body.question || typeof body.question !== 'string') {
    return res.status(400).json({ error: 'question is required' });
  }

  // 圈子口令
  if (process.env.PASSCODE && body.passcode !== process.env.PASSCODE) {
    return res.status(403).json({ error: 'wrong passcode' });
  }

  // 限流
  const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown';
  const limit = parseInt(process.env.DAILY_LIMIT ?? '20', 10);
  if (!checkRate(ip, limit)) {
    return res.status(429).json({ error: 'rate limited' });
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const model = process.env.MODEL ?? 'deepseek-chat';

  // 上游调用（非流式，50s 超时，确保在 maxDuration 内可控失败）
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  let upstream;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: 0.5,
        max_tokens: 900,
        messages: buildMessages(body),
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const isAbort = e?.name === 'AbortError';
    return res.status(502).json({ error: isAbort ? 'upstream timeout' : `upstream fetch failed: ${String(e)}` });
  }
  clearTimeout(timer);

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return res.status(502).json({ error: `upstream ${upstream.status}`, detail: detail.slice(0, 300) });
  }

  const json = await upstream.json().catch(() => null);
  const answer = json?.choices?.[0]?.message?.content ?? '';
  if (!answer) return res.status(502).json({ error: 'empty upstream answer' });

  return res.status(200).json({ answer });
}
