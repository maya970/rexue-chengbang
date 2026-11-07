import { isSea, terrainAt, walkableLand } from "./map";
import type { Terrain } from "../types";

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export interface PlannedPath {
  ok: boolean;
  reason?: string;
  naval: boolean;
  tiles: { x: number; y: number }[];
  landSteps: number;
  seaSteps: number;
  dist: number;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function heur(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function passable(t: Terrain, naval: boolean, allowLand: boolean, allowSea: boolean): boolean {
  if (t === "mountain") return false;
  if (isSea(t)) return allowSea;
  if (walkableLand(t)) return allowLand || (naval && t === "coast");
  return false;
}

function astar(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  allowLand: boolean,
  allowSea: boolean,
  naval: boolean,
  limit = 2200,
): { x: number; y: number }[] | null {
  const start = key(sx, sy);
  const goal = key(tx, ty);
  const open: { x: number; y: number; f: number }[] = [{ x: sx, y: sy, f: heur(sx, sy, tx, ty) }];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[start, 0]]);
  const seen = new Set<string>();

  while (open.length && seen.size < limit) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.x, cur.y);
    if (seen.has(ck)) continue;
    seen.add(ck);
    if (ck === goal) break;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const nk = key(nx, ny);
      if (!passable(terrainAt(nx, ny), naval, allowLand, allowSea) && nk !== goal) continue;
      const step = dx !== 0 && dy !== 0 ? 1.41 : 1;
      const ng = (gScore.get(ck) || 0) + step;
      const prev = gScore.get(nk);
      if (prev === undefined || ng < prev) {
        gScore.set(nk, ng);
        came.set(nk, ck);
        open.push({ x: nx, y: ny, f: ng + heur(nx, ny, tx, ty) });
      }
    }
  }

  if (!came.has(goal) && start !== goal) return start === goal ? [{ x: sx, y: sy }] : null;
  const tiles: { x: number; y: number }[] = [];
  let k = goal;
  tiles.push({ x: tx, y: ty });
  while (k !== start) {
    const prev = came.get(k);
    if (!prev) break;
    const [x, y] = prev.split(",").map(Number);
    tiles.push({ x, y });
    k = prev;
  }
  tiles.reverse();
  if (tiles[0]?.x !== sx || tiles[0]?.y !== sy) tiles.unshift({ x: sx, y: sy });
  return tiles;
}

function countSea(tiles: { x: number; y: number }[]): { sea: number; land: number } {
  let sea = 0;
  let land = 0;
  for (const p of tiles) {
    if (isSea(terrainAt(p.x, p.y))) sea += 1;
    else land += 1;
  }
  return { sea, land };
}

export function planPath(sx: number, sy: number, tx: number, ty: number, allowNaval: boolean): PlannedPath {
  if (sx === tx && sy === ty) {
    return { ok: false, reason: "目标与出发地相同", naval: false, tiles: [], landSteps: 0, seaSteps: 0, dist: 0 };
  }

  const land = astar(sx, sy, tx, ty, true, false, false);
  if (land) {
    const c = countSea(land);
    if (c.sea === 0) {
      return { ok: true, naval: false, tiles: land, landSteps: c.land, seaSteps: 0, dist: Math.max(1, land.length - 1) };
    }
  }

  if (!allowNaval) {
    return {
      ok: false,
      reason: "此路隔海。出海必须先有港口，再带运输船与三列桨座。",
      naval: true,
      tiles: [],
      landSteps: 0,
      seaSteps: 0,
      dist: 0,
    };
  }

  const mixed = astar(sx, sy, tx, ty, true, true, true);
  if (!mixed) {
    return { ok: false, reason: "无法规划航线", naval: true, tiles: [], landSteps: 0, seaSteps: 0, dist: 0 };
  }
  const c = countSea(mixed);
  if (c.sea === 0) {
    return { ok: true, naval: false, tiles: mixed, landSteps: c.land, seaSteps: 0, dist: Math.max(1, mixed.length - 1) };
  }
  return {
    ok: true,
    naval: true,
    tiles: mixed,
    landSteps: c.land,
    seaSteps: c.sea,
    dist: Math.max(1, mixed.length - 1),
  };
}

export function marchSeconds(dist: number, speed: number, naval: boolean, harbor: number): number {
  const bonus = naval ? 1 - Math.min(0.35, harbor * 0.03) : 1;
  const tileSec = naval ? 8 : 11;
  return Math.max(14, Math.floor(((dist * tileSec * 8) / Math.max(4, speed)) * bonus));
}

export function posAt(path: { x: number; y: number }[], startAt: number, arriveAt: number, t: number): { x: number; y: number; index: number } {
  if (!path.length) return { x: 0, y: 0, index: 0 };
  const span = Math.max(1, arriveAt - startAt);
  const p = Math.min(1, Math.max(0, (t - startAt) / span));
  const index = Math.min(path.length - 1, Math.floor(p * (path.length - 1)));
  return { ...path[index], index };
}

export function timeAtIndex(startAt: number, arriveAt: number, pathLen: number, index: number): number {
  const n = Math.max(1, pathLen - 1);
  return startAt + ((arriveAt - startAt) * index) / n;
}
