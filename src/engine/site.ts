import type { BuildingId } from "../types";
import { BUILDINGS } from "./catalog";
import { hashXY, terrainAt } from "./map";

export function frontageAt(x: number, y: number): number {
  const t = terrainAt(x, y);
  const raw = 4 + (hashXY(x, y, 91) % 9);
  if (t === "mountain") return Math.max(3, raw - 3);
  if (t === "forest") return Math.max(4, raw - 1);
  if (t === "coast") return raw + 1;
  if (t === "sea") return Math.min(12, raw + 2);
  return Math.min(12, Math.max(3, raw));
}

export function buildMultAt(x: number, y: number): Partial<Record<BuildingId, number>> {
  const out: Partial<Record<BuildingId, number>> = {};
  (Object.keys(BUILDINGS) as BuildingId[]).forEach((id, i) => {
    const n = hashXY(x, y, 200 + i) / 4294967296;
    out[id] = 0.62 + n * 1.15;
  });
  return out;
}

export function empireTimeFactor(cityCount: number, personCards: number, slaveCards: number): number {
  return (1 + Math.max(0, cityCount - 1) * 0.06) * (1 + personCards * 0.008 + slaveCards * 0.006);
}

export function slaveCostFor(nextLevel: number): number {
  return Math.max(1, Math.ceil(nextLevel / 2));
}

export function workersFor(nextLevel: number): number {
  return 1 + Math.floor((nextLevel - 1) / 2);
}
