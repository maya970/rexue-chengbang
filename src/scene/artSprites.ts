import type { BuildingId, HamletKind } from "../types";

const SETTLE_URL = "./art/settlements.jpg";
const BUILD_URL = "./art/buildings.jpg";
const NPC_URL = "./art/npc.jpg";

const settleCache: HTMLCanvasElement[] = [];
const buildCache: HTMLCanvasElement[] = [];
const npcCache: HTMLCanvasElement[] = [];
let settleReady = false;
let buildReady = false;
let npcReady = false;

function isMagenta(r: number, g: number, b: number, a: number) {
  if (a < 8) return true;
  const mag = (r + b) / 2 - g;
  return mag > 50 && g < 160 && r > 80 && b > 80;
}

function keyedImage(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    if (isMagenta(d[i], d[i + 1], d[i + 2], d[i + 3])) d[i + 3] = 0;
  }
  ctx.putImageData(im, 0, 0);
  return { c, d, w: c.width, h: c.height };
}

function crop(src: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.drawImage(src, x0, y0, w, h, 0, 0, w, h);
  return out;
}

function extractBlobs(img: HTMLImageElement, keep: number) {
  const { c, d, w, h } = keyedImage(img);
  const seen = new Uint8Array(w * h);
  const blobs: { x0: number; y0: number; x1: number; y1: number; area: number; cx: number; cy: number }[] = [];
  const minA = Math.max(80, (w * h) / 400);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (seen[i] || d[i * 4 + 3] < 20) continue;
      let x0 = x;
      let y0 = y;
      let x1 = x;
      let y1 = y;
      let area = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const p = stack.pop()!;
        const px = p % w;
        const py = (p - px) / w;
        area += 1;
        if (px < x0) x0 = px;
        if (py < y0) y0 = py;
        if (px > x1) x1 = px;
        if (py > y1) y1 = py;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = px + dx;
          const ny = py + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni] || d[ni * 4 + 3] < 20) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      const bw = x1 - x0 + 1;
      const bh = y1 - y0 + 1;
      if (area < minA || bh < h * 0.12 || bw / bh > 6) continue;
      blobs.push({ x0, y0, x1, y1, area, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }
  blobs.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  const rows: typeof blobs[] = [];
  for (const b of blobs) {
    const last = rows[rows.length - 1];
    if (!last || Math.abs(b.cy - last[0].cy) > h * 0.12) rows.push([b]);
    else last.push(b);
  }
  for (const row of rows) row.sort((a, b) => a.cx - b.cx);
  const ordered = rows.flat();
  return ordered.slice(0, keep).map((b) => crop(c, b.x0, b.y0, b.x1, b.y1));
}

function loadSheet(url: string, keep: number, into: HTMLCanvasElement[], done: (ok: boolean) => void) {
  const img = new Image();
  img.onload = () => {
    into.length = 0;
    into.push(...extractBlobs(img, keep));
    done(into.length >= Math.min(keep, 4));
  };
  img.onerror = () => done(false);
  img.src = url;
}

loadSheet(SETTLE_URL, 6, settleCache, (ok) => { settleReady = ok; });
loadSheet(BUILD_URL, 10, buildCache, (ok) => { buildReady = ok; });
loadSheet(NPC_URL, 3, npcCache, (ok) => { npcReady = ok; });

const SETTLE_IDX: Record<string, number> = {
  city: 0,
  village: 1,
  suburb: 2,
  urban: 3,
  barbarian: 4,
  system: 5,
};

const BUILD_IDX: Record<BuildingId, number> = {
  acropolis: 0,
  agora: 1,
  oikos: 2,
  barracks: 3,
  stables: 4,
  range: 5,
  wall: 6,
  temple: 7,
  shipyard: 8,
  harbor: 9,
};

export function settleSprite(kind: HamletKind | "barbarian" | "pirate" | "ruin" | "system") {
  if (kind === "barbarian" && npcReady && npcCache[0]) return npcCache[0];
  if (kind === "pirate" && npcReady && npcCache[1]) return npcCache[1];
  if (kind === "ruin" && npcReady && npcCache[2]) return npcCache[2];
  if (!settleReady) return undefined;
  if (kind === "barbarian" || kind === "pirate" || kind === "ruin") return settleCache[SETTLE_IDX.barbarian];
  return settleCache[SETTLE_IDX[kind] ?? 0];
}

export function buildingSprite(id: BuildingId) {
  if (!buildReady) return undefined;
  return buildCache[BUILD_IDX[id]];
}

/** (x,y) is iso diamond TOP vertex. Sprite feet sit on the top face. */
export function plantSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  scale: number,
  opts?: { width?: number; flip?: boolean; foot?: number },
) {
  const tw = (opts?.width ?? 0.88) * 40 * scale;
  const iw = "width" in img ? Number(img.width) : tw;
  const ih = "height" in img ? Number(img.height) : tw;
  const h = tw * (ih / Math.max(1, iw));
  const foot = (opts?.foot ?? 0.92) * 20 * scale;
  const dy = y + foot - h;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "rgba(18,10,6,0.32)";
  ctx.beginPath();
  ctx.ellipse(x, y + foot, tw * 0.26, 3.2 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  if (opts?.flip) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -tw / 2, dy, tw, h);
  } else {
    ctx.drawImage(img, x - tw / 2, dy, tw, h);
  }
  ctx.restore();
}
