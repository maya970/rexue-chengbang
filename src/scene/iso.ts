/** Ogre Battle-style 45° isometric blocks. Heights must stay connected. */

export { raiseConnect } from "../engine/height";

export const TW = 40;
export const TH = 20;
export const TZ = 8;

export function landDrop(elev: number, southElev: number) {
  return Math.max(0.35, elev - southElev);
}

/** yaw: 0 east, 1 south, 2 west, 3 north. Rotates the grid, not the camera roll. */
export function rotateCell(lx: number, ly: number, yaw: number, w: number, h: number) {
  const mx = w - 1;
  const my = h - 1;
  switch (yaw & 3) {
    case 1: return { x: my - ly, y: lx };
    case 2: return { x: mx - lx, y: my - ly };
    case 3: return { x: ly, y: mx - lx };
    default: return { x: lx, y: ly };
  }
}

export function unrotateCell(rx: number, ry: number, yaw: number, w: number, h: number) {
  const mx = w - 1;
  const my = h - 1;
  switch (yaw & 3) {
    case 1: return { x: ry, y: my - rx };
    case 2: return { x: mx - rx, y: my - ry };
    case 3: return { x: mx - ry, y: rx };
    default: return { x: rx, y: ry };
  }
}

/** Visible cliff neighbors after yaw: iso left = +ry, iso right = +rx. */
export function visNeighbor(lx: number, ly: number, yaw: number, w: number, h: number, side: "left" | "right") {
  const r = rotateCell(lx, ly, yaw, w, h);
  return unrotateCell(side === "right" ? r.x + 1 : r.x, side === "right" ? r.y : r.y + 1, yaw, w, h);
}

export function depthOf(lx: number, ly: number, yaw: number, w: number, h: number) {
  const r = rotateCell(lx, ly, yaw, w, h);
  return r.x + r.y;
}

export function project(
  lx: number,
  ly: number,
  elev: number,
  ox: number,
  oy: number,
  scale: number,
  yaw = 0,
  gw = 1,
  gh = 1,
) {
  const r = yaw ? rotateCell(lx, ly, yaw, gw, gh) : { x: lx, y: ly };
  return {
    x: (r.x - r.y) * (TW / 2) * scale + ox,
    y: (r.x + r.y) * (TH / 2) * scale - elev * TZ * scale + oy,
  };
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  drop: number,
  top: string,
  left: string,
  right: string,
) {
  drawBlockFaces(ctx, x, y, scale, drop, drop, top, left, right);
}

/** Two visible cliff faces, each from the neighboring height up so elevated tiles are solid underneath. */
export function drawBlockFaces(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  leftDrop: number,
  rightDrop: number,
  top: string,
  left: string,
  right: string,
) {
  const tw = TW * scale;
  const th = TH * scale;
  const lz = Math.max(scale * 0.45, leftDrop * TZ * scale);
  const rz = Math.max(scale * 0.45, rightDrop * TZ * scale);
  const hw = tw / 2;
  const hh = th / 2;
  const t = { x, y };
  const r = { x: x + hw, y: y + hh };
  const b = { x, y: y + th };
  const l = { x: x - hw, y: y + hh };
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + rz);
  ctx.lineTo(r.x, r.y + rz);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(l.x, l.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + lz);
  ctx.lineTo(l.x, l.y + lz);
  ctx.closePath();
  ctx.fillStyle = left;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(r.x, r.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(l.x, l.y);
  ctx.closePath();
  ctx.fillStyle = top;
  ctx.fill();
  ctx.strokeStyle = "rgba(20,12,8,0.35)";
  ctx.lineWidth = Math.max(1, scale * 0.5);
  ctx.stroke();
}

export function drawIsoHouse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  pal: { top: string; left: string; right: string },
  stories = 1,
) {
  drawBlockFaces(ctx, x, y, scale, stories, stories, pal.top, pal.left, pal.right);
}

export function drawLvTag(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, lv: number, peak?: number) {
  const text = peak && peak > lv ? `LV.${lv} (曾${peak})` : `LV.${lv}`;
  ctx.save();
  ctx.font = `bold ${Math.max(10, Math.round(9 * scale))}px "Noto Serif SC", serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = Math.max(2, scale);
  ctx.strokeStyle = "rgba(12,8,4,0.85)";
  ctx.fillStyle = "#f8f0a8";
  ctx.strokeText(text, x, y - 2 * scale);
  ctx.fillText(text, x, y - 2 * scale);
  ctx.restore();
}

export function textureIsoTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  img: CanvasImageSource,
  stroke = true,
) {
  const tw = TW * scale;
  const th = TH * scale;
  const hw = tw / 2;
  const hh = th / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + hw, y + hh);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x - hw, y + hh);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x - hw, y, tw, th);
  ctx.restore();
  if (!stroke) return;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + hw, y + hh);
  ctx.lineTo(x, y + th);
  ctx.lineTo(x - hw, y + hh);
  ctx.closePath();
  ctx.strokeStyle = "rgba(16,10,6,0.28)";
  ctx.lineWidth = Math.max(1, scale * 0.45);
  ctx.stroke();
}

export function drawFlatTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  img: CanvasImageSource,
) {
  textureIsoTop(ctx, x, y, scale, img);
}

const spriteFoot = new WeakMap<HTMLCanvasElement, number>();

function opaqueFoot(img: HTMLCanvasElement) {
  const hit = spriteFoot.get(img);
  if (hit) return hit;
  const g = img.getContext("2d");
  if (!g) return 1;
  const { width: w, height: h } = img;
  const data = g.getImageData(0, 0, w, h).data;
  let last = h;
  for (let row = h - 1; row >= 0; row -= 1) {
    for (let col = 0; col < w; col += 1) {
      if (data[(row * w + col) * 4 + 3] > 12) {
        last = row + 1;
        row = -1;
        break;
      }
    }
  }
  const frac = Math.max(0.35, last / h);
  spriteFoot.set(img, frac);
  return frac;
}

export function drawIsoSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  img: CanvasImageSource,
  size = 16,
  foot = 0.78,
) {
  ctx.imageSmoothingEnabled = false;
  const s = Math.min(TH * scale * 1.35, TW * scale * 0.62, size * scale);
  const pad = img instanceof HTMLCanvasElement ? opaqueFoot(img) : 1;
  const footY = y + TH * scale * foot;
  ctx.drawImage(img, x - s / 2, footY - s * pad, s, s);
}

export function inBlock(px: number, py: number, x: number, y: number, scale: number, drop: number) {
  const tw = TW * scale;
  const th = TH * scale;
  const tz = Math.max(scale, drop * TZ * scale);
  const hw = tw / 2;
  const hh = th / 2;
  const cx = x;
  const cy = y + hh;
  const nx = (px - cx) / hw;
  const ny = (py - cy) / hh;
  if (Math.abs(nx) + Math.abs(ny) <= 1) return true;
  const ny2 = (py - cy - tz / 2) / (hh + tz / 2);
  return py >= cy && py <= cy + hh + tz && Math.abs(nx) + Math.abs(ny2) <= 1.15;
}

export function palette(kind: "sea" | "coast" | "plain" | "forest" | "mountain" | "plot" | "road" | "build", variant = 0) {
  if (kind === "sea") return { top: variant ? "#2a7aaa" : "#1e6a96", left: "#0e3a58", right: "#185878" };
  if (kind === "coast") return { top: "#e0c488", left: "#8a6a40", right: "#b89458" };
  if (kind === "plain") return { top: "#7cb050", left: "#3a6828", right: "#5a8838" };
  if (kind === "forest") return { top: "#3e8a48", left: "#1c4a24", right: "#2e6a34" };
  if (kind === "mountain") return { top: variant ? "#d8d0c4" : "#a89888", left: "#5a5048", right: "#7a7068" };
  if (kind === "road") return { top: "#b8b0a0", left: "#5a5448", right: "#7a7468" };
  if (kind === "build") return { top: "#d8c8b0", left: "#6a5040", right: "#8a6c54" };
  return { top: "#86b45a", left: "#3e6a30", right: "#5e8a40" };
}
