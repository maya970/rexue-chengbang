import { WORLD_SEED } from "./catalog";
import type { Terrain } from "../types";

export function hashXY(x: number, y: number, seed = WORLD_SEED): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ Math.imul(x | 0, 2246822519), 3266489917);
  h = Math.imul(h ^ Math.imul(y | 0, 668265263), 374761393);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return h >>> 0;
}

export function rand01(x: number, y: number, salt = 0): number {
  return hashXY(x, y, WORLD_SEED + salt) / 4294967296;
}

/** 一张大地图边长。外圈固定是海，内部 1～2 座孤岛。 */
export const CHART = 40;
export const CHART_SEA = 5;

export function chartOf(x: number, y: number) {
  return { cx: Math.floor(x / CHART), cy: Math.floor(y / CHART) };
}

export function chartOrigin(cx: number, cy: number) {
  return { x: cx * CHART, y: cy * CHART };
}

export function chartCenter(cx: number, cy: number) {
  return { x: cx * CHART + Math.floor(CHART / 2), y: cy * CHART + Math.floor(CHART / 2) };
}

export function islandCount(cx: number, cy: number): 1 | 2 {
  return hashXY(cx, cy, 17) % 5 < 2 ? 2 : 1;
}

const CHART_A = ["银沙", "黑潮", "琥珀", "雾角", "双月", "赤礁", "苍风", "铜铃", "象牙", "残阳", "青岚", "白帆"];
const CHART_B = ["海图", "屿图", "礁图", "湾图"];

export function chartName(cx: number, cy: number) {
  const a = CHART_A[hashXY(cx, cy, 21) % CHART_A.length];
  const b = CHART_B[hashXY(cx, cy, 22) % CHART_B.length];
  return `${a}${b}·${islandCount(cx, cy) === 2 ? "双屿" : "孤岛"}`;
}

function islandCenters(cx: number, cy: number) {
  const inner = CHART - CHART_SEA * 2;
  const n = islandCount(cx, cy);
  if (n === 1) {
    const jx = (hashXY(cx, cy, 31) % 1000) / 1000;
    const jy = (hashXY(cx, cy, 32) % 1000) / 1000;
    return [{
      x: CHART_SEA + inner * (0.28 + jx * 0.44),
      y: CHART_SEA + inner * (0.28 + jy * 0.44),
      r: inner * (0.28 + (hashXY(cx, cy, 33) % 80) / 400),
    }];
  }
  const split = hashXY(cx, cy, 34) % 2 === 0;
  const j = (hashXY(cx, cy, 35) % 80) / 400;
  if (split) {
    return [
      { x: CHART_SEA + inner * (0.28 + j), y: CHART_SEA + inner * 0.38, r: inner * 0.22 },
      { x: CHART_SEA + inner * (0.72 - j), y: CHART_SEA + inner * 0.62, r: inner * 0.22 },
    ];
  }
  return [
    { x: CHART_SEA + inner * 0.4, y: CHART_SEA + inner * (0.26 + j), r: inner * 0.21 },
    { x: CHART_SEA + inner * 0.62, y: CHART_SEA + inner * (0.74 - j), r: inner * 0.21 },
  ];
}

export function landAt(x: number, y: number): boolean {
  const { cx, cy } = chartOf(x, y);
  const lx = x - cx * CHART;
  const ly = y - cy * CHART;
  if (lx < CHART_SEA || ly < CHART_SEA || lx >= CHART - CHART_SEA || ly >= CHART - CHART_SEA) return false;
  const n = rand01(x, y, 4);
  for (const c of islandCenters(cx, cy)) {
    const dx = (lx - c.x) / c.r;
    const dy = (ly - c.y) / (c.r * 0.9);
    if (dx * dx + dy * dy < 1 - n * 0.2) return true;
  }
  return false;
}

export function terrainAt(x: number, y: number): Terrain {
  if (!landAt(x, y)) return "sea";
  const wet =
    !landAt(x + 1, y) || !landAt(x - 1, y) || !landAt(x, y + 1) || !landAt(x, y - 1);
  if (wet) return "coast";
  const n = rand01(x, y, 1);
  if (n > 0.86) return "mountain";
  if (n > 0.64) return "forest";
  return "plain";
}

export function walkableLand(t: Terrain): boolean {
  return t === "plain" || t === "forest" || t === "coast" || t === "mountain";
}

export function isSea(t: Terrain): boolean {
  return t === "sea";
}

export function isCoast(t: Terrain): boolean {
  return t === "coast";
}

/** 海岸或海域：能停船、建港。 */
export function isWater(t: Terrain): boolean {
  return t === "sea" || t === "coast";
}

export function canFound(t: Terrain): boolean {
  return t === "plain" || t === "coast" || t === "forest" || t === "mountain" || t === "sea";
}

export function tileName(t: Terrain): string {
  return { sea: "海域", coast: "海岸", plain: "平原", forest: "林地", mountain: "山地" }[t];
}

export function cityIdAt(x: number, y: number): string {
  return `city:${x}:${y}`;
}

export interface NpcSite {
  x: number;
  y: number;
  name: string;
  kind: "polis" | "tribe" | "pirates";
  level: number;
}

const POLIS_NAMES = ["雅典残垒", "斯巴达哨堡", "科林斯商埠", "底比斯营地", "德尔斐神祠", "米利都港", "罗德岛寨", "阿尔戈斯丘"];
const TRIBE_NAMES = ["燧石原始部落", "兽骨寨", "赤土聚落", "狼牙营地", "泥屋部落", "渔叉原人", "丘顶野人", "灰烬营地", "巨石圈", "无火村"];

export function tribeLevelAt(x: number, y: number): number {
  const d = Math.hypot(x, y);
  return Math.min(16, 1 + (hashXY(x, y, 51) % 8) + Math.floor(d / 14));
}

export function npcAt(x: number, y: number): NpcSite | null {
  const t = terrainAt(x, y);
  const r = rand01(x, y, 9);
  const level = tribeLevelAt(x, y);
  if (t === "sea" && r > 0.972) {
    return { x, y, name: `海盗船队·${level}级`, kind: "pirates", level };
  }
  if (t === "sea") return null;
  if (r > 0.984) {
    const i = hashXY(x, y, 77) % POLIS_NAMES.length;
    return { x, y, name: `${POLIS_NAMES[i]}·${level}级`, kind: "polis", level };
  }
  if (r > 0.938) {
    const i = hashXY(x, y, 81) % TRIBE_NAMES.length;
    return { x, y, name: `${TRIBE_NAMES[i]}·${level}级`, kind: "tribe", level };
  }
  return null;
}

export function npcPower(site: NpcSite): number {
  const base = site.kind === "polis" ? 40 : site.kind === "pirates" ? 32 : 18;
  return Math.floor(base + site.level * 14);
}

export function respawnMs(level: number): number {
  return (90 + level * 25) * 1000;
}
