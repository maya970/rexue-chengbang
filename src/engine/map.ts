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

export function terrainAt(x: number, y: number): Terrain {
  const n = rand01(x, y, 1);
  const ridge = Math.sin((y + n * 3) / 14) * 0.33 + Math.sin((x - y) / 36) * 0.16;
  const v = n * 0.7 + (ridge + 0.33);
  if (v < 0.46) return "sea";
  if (v < 0.54) return "coast";
  if (v > 0.92) return "mountain";
  if (v > 0.78) return "forest";
  return "plain";
}

export function walkableLand(t: Terrain): boolean {
  return t === "plain" || t === "forest" || t === "coast";
}

export function isSea(t: Terrain): boolean {
  return t === "sea";
}

export function isCoast(t: Terrain): boolean {
  return t === "coast";
}

export function canFound(t: Terrain): boolean {
  return t === "plain" || t === "coast" || t === "forest";
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
  if (!canFound(t)) return null;
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
