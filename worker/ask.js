/**
 * 灵修伴读 · AI 灵修问答代理（Cloudflare Worker）
 *
 * 职责：
 *  1. 隐藏大模型 API Key（只存 Worker 环境变量，绝不下发前端）
 *  2. 圈子口令校验（可选，防止链接外传后被公开使用）
 *  3. 基础限流（每 IP 每天 20 次；严格限流建议接 Workers KV / Durable Objects）
 *  4. 拼接 RAG Prompt：系统指令 + 前端检索到的经文/注解上下文 + 用户问题
 *
 * 环境变量（wrangler secret / vars 配置）：
 *  OPENAI_API_KEY   必填，OpenAI 兼容接口的 Key（可用 GPT-4o-mini / Claude / 国产模型网关）
 *  OPENAI_BASE_URL  可选，默认 https://api.openai.com/v1
 *  MODEL            可选，默认 gpt-4o-mini
 *  PASSCODE         可选，圈子口令；设置后前端必须带正确口令
 *  DAILY_LIMIT      可选，每 IP 每天限次，默认 20
 *
 * 请求：POST /api/ask  { question, context: [{ref,text}], passcode? }
 * 响应：OpenAI 兼容的 SSE 流式（text/event-stream）透传
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `你是「灵修伴读」的灵修问答助手，为基督徒小圈子服务。规则：
1. 你只能依据：① 中文和合本圣经原文 ② 提供的公有领域注解资料 来回答，不得凭空编造经文或出处。
2. 回答中引用经文时必须标注出处（书卷 章:节），引用要准确。
3. 保持温和福音派基调；遇到有争议的教义（如预定论、灵恩等），不站队，呈现多方观点。
4. 语气像一位稳妥的同工：先同理提问者的处境，再用经文回应。
5. 回答控制在 300 字以内，分小段，便于手机阅读。
6. 回答末尾必须固定附上：「AI 回答仅供参考，重要问题请与牧者/传道人交通。」
7. 若问题与信仰/圣经无关，礼貌地引导回圣经与灵修话题。`;

// 简易内存限流（单实例有效；多实例部署请改用 KV）
const rateMap = new Map();

function checkRate(ip, limit) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `${ip}:${day}`;
  const count = (rateMap.get(key) ?? 0) + 1;
  rateMap.set(key, count);
  if (rateMap.size > 10000) rateMap.clear(); // 防内存膨胀
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (url.pathname !== '/api/ask') {
      // 非 API 路径交给 Workers 静态资源（dist/ 前端；SPA 回退在 wrangler.toml 配置）
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not Found', { status: 404 });
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    if (!env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400, headers: CORS_HEADERS });
    }

    // 圈子口令
    if (env.PASSCODE && body.passcode !== env.PASSCODE) {
      return new Response(JSON.stringify({ error: 'wrong passcode' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 限流
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const limit = parseInt(env.DAILY_LIMIT ?? '20', 10);
    if (!checkRate(ip, limit)) {
      return new Response(JSON.stringify({ error: 'rate limited' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const baseUrl = (env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = env.MODEL ?? 'gpt-4o-mini';

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.5,
        max_tokens: 900,
        messages: buildMessages(body),
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return new Response(JSON.stringify({ error: `upstream ${upstream.status}`, detail: errText.slice(0, 300) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    // 透传 SSE 流
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        ...CORS_HEADERS,
      },
    });
  },
};
