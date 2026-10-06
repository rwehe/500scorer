/**
 * Felt-green app icons. Spade + seven-segment "500". No people.
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const GOLD = [232, 194, 100, 255];
const GOLD_DEEP = [168, 124, 36, 255];
const FELT_TOP = [20, 92, 63, 255];
const FELT_BOT = [6, 36, 23, 255];
const FELT = [10, 51, 34, 255];

function canvas(w, h) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

function setPx(c, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  const a = color[3] / 255;
  if (a >= 0.999) {
    c.data[i] = color[0];
    c.data[i + 1] = color[1];
    c.data[i + 2] = color[2];
    c.data[i + 3] = 255;
    return;
  }
  const dstA = c.data[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  c.data[i] = Math.round((color[0] * a + c.data[i] * dstA * (1 - a)) / outA);
  c.data[i + 1] = Math.round((color[1] * a + c.data[i + 1] * dstA * (1 - a)) / outA);
  c.data[i + 2] = Math.round((color[2] * a + c.data[i + 2] * dstA * (1 - a)) / outA);
  c.data[i + 3] = Math.round(outA * 255);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    255,
  ];
}

function fillGradient(c) {
  for (let y = 0; y < c.h; y++) {
    const color = mix(FELT_TOP, FELT_BOT, y / Math.max(1, c.h - 1));
    for (let x = 0; x < c.w; x++) setPx(c, x, y, color);
  }
}

function fillSolid(c, color) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) setPx(c, x, y, color);
}

function fillPolygon(c, points, color) {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(c.h - 1, Math.ceil(maxY));
  for (let y = y0; y <= y1; y++) {
    const scan = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) {
        const t = (scan - a[1]) / (b[1] - a[1]);
        xs.push(a[0] + t * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xStart = Math.max(0, Math.ceil(xs[i]));
      const xEnd = Math.min(c.w - 1, Math.floor(xs[i + 1]));
      for (let x = xStart; x <= xEnd; x++) setPx(c, x, y, color);
    }
  }
}

function cubic(p0, p1, p2, p3, steps = 18) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

function mapPoints(pts, x, y, w, h) {
  return pts.map(([px, py]) => [x + (px / 100) * w, y + (py / 100) * h]);
}

/** Spade body in a 0..100 box: point at the top, lobes at the bottom, stem below. */
function spadePolys() {
  const body = [
    ...cubic([50, 2], [50, 2], [8, 28], [8, 52]),
    ...cubic([8, 52], [8, 78], [28, 92], [46, 78]),
    ...cubic([46, 78], [50, 72], [50, 72], [50, 66]),
    ...cubic([50, 66], [50, 72], [50, 72], [54, 78]),
    ...cubic([54, 78], [72, 92], [92, 78], [92, 52]),
    ...cubic([92, 52], [92, 28], [50, 2], [50, 2]),
  ];
  const stem = [
    [46, 64],
    [42, 100],
    [58, 100],
    [54, 64],
  ];
  return { body, stem };
}

function drawSpade(c, x, y, w, h, color) {
  const { body, stem } = spadePolys();
  fillPolygon(c, mapPoints(body, x, y, w, h), color);
  fillPolygon(c, mapPoints(stem, x, y, w, h), color);
}

const SEGS = {
  5: ['a', 'f', 'g', 'c', 'd'],
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
};

function fillRoundRect(c, x, y, w, h, r, color) {
  const rr = Math.min(r, w / 2, h / 2);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const cx = Math.min(Math.max(px + 0.5, x + rr), x + w - rr);
      const cy = Math.min(Math.max(py + 0.5, y + rr), y + h - rr);
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy <= rr * rr && px + 0.5 >= x && px + 0.5 <= x + w && py + 0.5 >= y && py + 0.5 <= y + h) {
        setPx(c, px, py, color);
      }
    }
  }
}

function drawDigit(c, x, y, w, h, digit, color) {
  const t = Math.max(2, w * 0.2);
  const gap = Math.max(1, t * 0.28);
  const on = new Set(SEGS[digit]);
  const mid = y + (h - t) / 2;
  const hbar = (yy) => fillRoundRect(c, x + gap, yy, w - gap * 2, t, t / 2, color);
  const vbar = (xx, yy, hh) => fillRoundRect(c, xx, yy, t, hh, t / 2, color);
  if (on.has('a')) hbar(y);
  if (on.has('g')) hbar(mid);
  if (on.has('d')) hbar(y + h - t);
  if (on.has('f')) vbar(x, y + gap, mid - y - gap);
  if (on.has('b')) vbar(x + w - t, y + gap, mid - y - gap);
  if (on.has('e')) vbar(x, mid + t, y + h - t - (mid + t));
  if (on.has('c')) vbar(x + w - t, mid + t, y + h - t - (mid + t));
}

function draw500(c, cx, y, width, color) {
  const gap = width * 0.06;
  const dw = (width - gap * 2) / 3;
  const dh = dw * 1.45;
  const digits = [5, 0, 0];
  digits.forEach((d, i) => drawDigit(c, cx - width / 2 + i * (dw + gap), y, dw, dh, d, color));
  return dh;
}

/** Transparent square: spade over a 500 readout. Both stay inside the canvas. */
function renderArtwork(size, { digits = true } = {}) {
  const c = canvas(size, size);
  const pad = size * 0.07;
  if (!digits) {
    const side = size - pad * 2;
    drawSpade(c, pad + size * 0.015, pad + size * 0.02, side, side, GOLD_DEEP);
    drawSpade(c, pad, pad, side, side, GOLD);
    return c;
  }
  const digitW = size * 0.74;
  const gap = digitW * 0.06;
  const dw = (digitW - gap * 2) / 3;
  const dh = dw * 1.45;
  const digitTop = size - pad - dh;
  const spadeTop = pad;
  const spadeH = digitTop - spadeTop - size * 0.03;
  const spadeW = Math.min(size - pad * 2, spadeH * 0.95);
  const spadeX = (size - spadeW) / 2;
  drawSpade(c, spadeX + size * 0.012, spadeTop + size * 0.015, spadeW, spadeH, GOLD_DEEP);
  drawSpade(c, spadeX, spadeTop, spadeW, spadeH, GOLD);
  draw500(c, size / 2, digitTop, digitW, GOLD);
  return c;
}

function blit(dest, src, dx, dy, dw, dh) {
  for (let y = 0; y < dh; y++) {
    const sy = ((y + 0.5) * src.h) / dh - 0.5;
    const y0 = Math.floor(sy);
    const y1 = Math.min(src.h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = ((x + 0.5) * src.w) / dw - 0.5;
      const x0 = Math.floor(sx);
      const x1 = Math.min(src.w - 1, x0 + 1);
      const fx = sx - x0;
      const samples = [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x1, y0, fx * (1 - fy)],
        [x0, y1, (1 - fx) * fy],
        [x1, y1, fx * fy],
      ];
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (const [px, py, w] of samples) {
        if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
        const i = (py * src.w + px) * 4;
        const sa = src.data[i + 3] / 255;
        r += src.data[i] * sa * w;
        g += src.data[i + 1] * sa * w;
        b += src.data[i + 2] * sa * w;
        a += sa * w;
      }
      if (a < 0.02) continue;
      setPx(dest, dx + x, dy + y, [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round(a * 255)]);
    }
  }
}

function icon(size, { maskable = false, digits = true, solid = false } = {}) {
  const c = canvas(size, size);
  if (solid) fillSolid(c, FELT);
  else fillGradient(c);
  const art = renderArtwork(size * 2, { digits });
  const scale = maskable ? 0.58 : digits ? 0.86 : 0.78;
  const dw = Math.round(size * scale);
  blit(c, art, Math.round((size - dw) / 2), Math.round((size - dw) / 2), dw, dw);
  return c;
}

function splash(w, h) {
  const c = canvas(w, h);
  fillGradient(c);
  const art = renderArtwork(640, { digits: true });
  const dw = Math.round(Math.min(w * 0.62, 720));
  blit(c, art, Math.round((w - dw) / 2), Math.round(h * 0.36 - dw / 2), dw, dw);
  return c;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h);
  for (let y = 0; y < c.h; y++) {
    const start = y * (c.w * 4 + 1);
    raw[start] = 0;
    raw.set(c.data.subarray(y * c.w * 4, (y + 1) * c.w * 4), start + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeICO(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

function write(rel, image, { ico = false } = {}) {
  const file = path.join('public', rel);
  mkdirSync(path.dirname(file), { recursive: true });
  const png = encodePNG(image);
  const bytes = ico ? encodeICO(png) : png;
  writeFileSync(file, bytes);
  console.log(`${rel} ${image.w}x${image.h} ${bytes.length} bytes`);
}

write('favicon-16x16.png', icon(16, { digits: false, solid: true }));
const favicon32 = icon(32, { digits: false, solid: true });
write('favicon-32x32.png', favicon32);
write('favicon.ico', favicon32, { ico: true });
write('apple-touch-icon.png', icon(180));
const icon192 = icon(192);
const icon512 = icon(512);
write('icons/icon-192.png', icon192);
write('android-chrome-192x192.png', icon192);
write('icons/icon-512.png', icon512);
write('android-chrome-512x512.png', icon512);
write('icons/icon-maskable-512.png', icon(512, { maskable: true }));
write('splash/iphone-1170x2532.png', splash(1170, 2532));
write('splash/iphone-1179x2556.png', splash(1179, 2556));
write('splash/iphone-1290x2796.png', splash(1290, 2796));
