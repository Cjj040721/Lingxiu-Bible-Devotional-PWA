/**
 * api/ask.js 的类型声明（Vercel Serverless 处理器为 JS 编写）。
 * 供 vite.config.ts 的本地 dev 中间件动态 import 使用。
 */
export interface AskRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: { question?: string; context?: { ref: string; text: string }[]; passcode?: string };
}
export interface AskResponse {
  setHeader(k: string, v: string): void;
  status(code: number): AskResponse;
  json(obj: unknown): void;
  end(): void;
}
declare const handler: (req: AskRequest, res: AskResponse) => Promise<void>;
export default handler;
