/** Ogre Battle-style 45° isometric blocks. Heights must stay connected. */

export { raiseConnect } from "../engine/height";

export const TW = 40;
export const TH = 20;
export const TZ = 8;

export function landDrop(elev: number, southElev: number) {
  return Math.max(0.35, elev - southElev);
}

export function project(lx: number, ly: number, elev: number, ox: number, oy: number, scale: number) {
  return {
    x: (lx - ly) * (TW / 2) * scale + ox,
    y: (lx + ly) * (TH / 2) * scale - elev * TZ * scale + oy,
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
  const tw = TW * scale;
  const th = TH * scale;
  const tz = Math.max(scale, drop * TZ * scale);
  const hw = tw / 2;
  const hh = th / 2;
  const t = { x, y };
  const r = { x: x + hw, y: y + hh };
  const b = { x, y: y + th };
  const l = { x: x - hw, y: y + hh };
  ctx.beginPath();
  ctx.moveTo(r.x, r.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + tz);
  ctx.lineTo(r.x, r.y + tz);
  ctx.closePath();
  ctx.fillStyle = right;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(l.x, l.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x, b.y + tz);
  ctx.lineTo(l.x, l.y + tz);
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

export function drawIsoSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  img: CanvasImageSource,
  size = 16,
) {
  ctx.imageSmoothingEnabled = false;
  const s = size * scale * 0.95;
  ctx.drawImage(img, x - s / 2, y + (TH * scale) * 0.22 - s, s, s);
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
