/** 金句分享卡片：Canvas 生成，3 套简洁模板，导出 PNG */

export interface CardTheme {
  id: string;
  name: string;
  bg: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  textColor: string;
  refColor: string;
  footerColor: string;
  accent: string;
}

export const CARD_THEMES: CardTheme[] = [
  {
    id: 'dawn',
    name: '晨光',
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#fde8cf');
      g.addColorStop(0.55, '#f9d9b8');
      g.addColorStop(1, '#f3c39a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 太阳
      ctx.fillStyle = 'rgba(255, 244, 214, 0.9)';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.3, 130, 0, Math.PI * 2);
      ctx.fill();
      // 远山
      ctx.fillStyle = 'rgba(190, 130, 80, 0.35)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, h * 0.82);
      ctx.lineTo(w * 0.35, h * 0.66);
      ctx.lineTo(w * 0.6, h * 0.84);
      ctx.lineTo(w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    },
    textColor: '#4a2f1d',
    refColor: '#8a5a33',
    footerColor: 'rgba(74, 47, 29, 0.55)',
    accent: '#c56a2d',
  },
  {
    id: 'night',
    name: '静夜',
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#141a3a');
      g.addColorStop(1, '#2b3a6b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 星星
      let seed = 42;
      const rand = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      for (let i = 0; i < 90; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.7;
        const r = rand() * 1.8 + 0.4;
        ctx.globalAlpha = 0.25 + rand() * 0.65;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 月亮
      ctx.fillStyle = '#f5f0dc';
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.16, 56, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2450';
      ctx.beginPath();
      ctx.arc(w * 0.78 - 20, h * 0.16 - 14, 48, 0, Math.PI * 2);
      ctx.fill();
    },
    textColor: '#f3f0e4',
    refColor: '#c8cdf0',
    footerColor: 'rgba(243, 240, 228, 0.5)',
    accent: '#8ea2ff',
  },
  {
    id: 'meadow',
    name: '青草地',
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#e8f3e2');
      g.addColorStop(1, '#b9dcc0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 草地波浪
      ctx.fillStyle = 'rgba(88, 140, 96, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.quadraticCurveTo(w * 0.25, h * 0.72, w * 0.55, h * 0.86);
      ctx.quadraticCurveTo(w * 0.8, h * 0.97, w, h * 0.84);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    },
    textColor: '#24402c',
    refColor: '#3c6b4a',
    footerColor: 'rgba(36, 64, 44, 0.55)',
    accent: '#3f7d4e',
  },
];

const W = 900;
const H = 1200;
const SERIF = '"Songti SC", "Noto Serif SC", "SimSun", serif';
const SANS = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export interface CardContent {
  text: string;
  ref: string;
}

export function renderVerseCard(theme: CardTheme, content: CardContent): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  theme.bg(ctx, W, H);

  // 顶部小标记
  ctx.fillStyle = theme.accent;
  ctx.fillRect(W / 2 - 30, 96, 60, 6);

  // 经文（自动缩放以适应高度）
  const maxW = W - 160;
  let fontSize = 52;
  let lines: string[] = [];
  for (;;) {
    ctx.font = `${fontSize}px ${SERIF}`;
    lines = wrapText(ctx, content.text, maxW);
    const blockH = lines.length * fontSize * 1.7;
    if (blockH <= 620 || fontSize <= 30) break;
    fontSize -= 4;
  }
  const lineH = fontSize * 1.7;
  const totalH = lines.length * lineH;
  let y = (H - totalH) / 2 - 40;
  ctx.fillStyle = theme.textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const line of lines) {
    ctx.fillText(line, W / 2, y);
    y += lineH;
  }

  // 出处
  ctx.font = `600 36px ${SANS}`;
  ctx.fillStyle = theme.refColor;
  ctx.fillText(`—— ${content.ref} ——`, W / 2, y + 40);

  // 底部
  ctx.font = `28px ${SANS}`;
  ctx.fillStyle = theme.footerColor;
  ctx.fillText('灵修伴读 · 和合本', W / 2, H - 72);

  return canvas;
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
