/**
 * PWA 占位图标生成脚本（零依赖：内置 zlib 手工编码 PNG）
 * 设计：indigo 渐变圆角方底 + 白色十字架（占位用，后续可换正式设计）
 * 输出: public/icons/*.png
 * 运行: node scripts/generate-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

/* ---------- CRC32 ---------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const scan = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    scan[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(scan, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(scan, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- 绘制 ---------- */
const BG_TOP = [0x43, 0x38, 0xca]; // #4338ca
const BG_BOTTOM = [0x63, 0x5b, 0xe0]; // 渐变亮端
const WHITE = [255, 255, 255];

function drawIcon(size, padRatio = 0) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const pad = size * padRatio;
  const inner = size - 2 * pad;

  const cx = size / 2;
  const crossCY = pad + inner * 0.42;
  const barW = inner * 0.085;
  const vLen = inner * 0.46;
  const hLen = inner * 0.3;
  const hY = crossCY - vLen * 0.2;

  const inRoundedRect = (x, y) => {
    // 四角圆弧裁剪
    const rx = Math.min(Math.max(x, radius), size - radius);
    const ry = Math.min(Math.max(y, radius), size - radius);
    const dx = x - rx;
    const dy = y - ry;
    return dx * dx + dy * dy <= radius * radius || (x >= radius && x <= size - radius) || (y >= radius && y <= size - radius);
  };
  const inBar = (x, y, x0, y0, x1, y1, r) => {
    const qx = Math.min(Math.max(x, x0 + r), x1 - r);
    const qy = Math.min(Math.max(y, y0 + r), y1 - r);
    const dx = x - qx;
    const dy = y - qy;
    return (x >= x0 && x <= x1 && y >= y0 + r && y <= y1 - r) ||
      (x >= x0 + r && x <= x1 - r && y >= y0 && y <= y1) ||
      dx * dx + dy * dy <= r * r;
  };
  const inCross = (x, y) =>
    inBar(x, y, cx - barW / 2, crossCY - vLen / 2, cx + barW / 2, crossCY + vLen / 2, barW / 2) ||
    inBar(x, y, cx - hLen / 2, hY - barW / 2, cx + hLen / 2, hY + barW / 2, barW / 2);

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t);
    const g = Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t);
    const b = Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t);
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      if (!inRoundedRect(x, y)) {
        px[o + 3] = 0; // 透明
        continue;
      }
      const c = inCross(x, y) ? WHITE : [r, g, b];
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const jobs = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0],
];
for (const [name, size, pad] of jobs) {
  const png = drawIcon(size, pad);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`✓ ${name} (${size}x${size}, ${png.length} bytes)`);
}
