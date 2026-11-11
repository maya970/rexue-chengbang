import { canColonize, cityIdAt, terrainAt } from "./map";
import { claimOwner } from "./realm";
import type { City, HamletKind, World } from "../types";

export const BASE_CITY_CAP = 4;
export const HAMLET_UNLOCK: Record<Exclude<HamletKind, "city">, number> = {
  village: 2,
  suburb: 5,
  urban: 9,
};
export const SETTLE_COST = { persons: 2, slaves: 1, supplies: 1 };
export const SITE_UPGRADE: Record<Exclude<HamletKind, "city" | "urban">, { to: HamletKind; supplies: number; slaves: number }> = {
  village: { to: "suburb", supplies: 3, slaves: 1 },
  suburb: { to: "urban", supplies: 6, slaves: 2 },
};

export function hamletOf(city: City): HamletKind {
  return city.hamlet || "city";
}

export function isHamlet(city: City) {
  const h = hamletOf(city);
  return h === "village" || h === "suburb" || h === "urban";
}

export function ringDist(ax: number, ay: number, bx: number, by: number) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function displayLevel(city: City) {
  if (city.npc) return city.tribeLevel || 1;
  if (hamletOf(city) === "village") return 1;
  if (hamletOf(city) === "suburb") return 2;
  if (hamletOf(city) === "urban") return 3;
  return city.buildings?.acropolis?.level || 1;
}

export function bumpPeak(city: City) {
  const lv = displayLevel(city);
  city.peakLevel = Math.max(city.peakLevel || 0, lv);
}

export function hamletLabel(kind: HamletKind) {
  if (kind === "village") return "乡村";
  if (kind === "suburb") return "郊区";
  if (kind === "urban") return "城区";
  return "城邦";
}

export function childrenOf(world: World, cityId: string) {
  const parent = world.cities[cityId];
  return Object.values(world.cities).filter((c) => c.parentId === cityId && (!parent || c.owner === parent.owner) && isHamlet(c));
}

/** 与城邦城域相连的附属乡村：从城格一圈圈邻接，中间被拆或占走则外圈不算。 */
export function linkedChildrenOf(world: World, city: City) {
  if (isHamlet(city)) return [];
  const kids = childrenOf(world, city.id);
  const linked: City[] = [];
  const seen = new Set<string>();
  const seed = kids.filter((c) => ringDist(city.x, city.y, c.x, c.y) === 1);
  const q = [...seed];
  for (const c of seed) seen.add(c.id);
  while (q.length) {
    const cur = q.shift()!;
    linked.push(cur);
    for (const n of kids) {
      if (seen.has(n.id)) continue;
      if (ringDist(cur.x, cur.y, n.x, n.y) !== 1) continue;
      seen.add(n.id);
      q.push(n);
    }
  }
  return linked;
}

export function inCityRealm(world: World, city: City, hamlet: City) {
  return linkedChildrenOf(world, city).some((c) => c.id === hamlet.id);
}

export function cityLevelCap(world: World, city: City) {
  if (isHamlet(city)) return 4;
  const bonus = linkedChildrenOf(world, city).reduce((n, c) => {
    const k = hamletOf(c);
    if (k === "city") return n;
    return n + HAMLET_UNLOCK[k];
  }, 0);
  return Math.min(16, BASE_CITY_CAP + bonus);
}

export function canFoundVillage(world: World, owner: string, parent: City, x: number, y: number): string | null {
  if (!parent || parent.owner !== owner) return "不是你的城邦";
  if (isHamlet(parent)) return "乡村不能再带乡村";
  if (world.cities[cityIdAt(x, y)]) return "已有聚落";
  if (!canColonize(terrainAt(x, y))) return "海域不能建乡村";
  const who = claimOwner(world, x, y);
  if (who && who !== owner) return "此地已被他人连通";
  const r = ringDist(parent.x, parent.y, x, y);
  if (r < 1) return "不能叠在城上";
  if (r === 1) return null;
  const kids = linkedChildrenOf(world, parent);
  const ok = kids.some((c) => {
    const cr = ringDist(parent.x, parent.y, c.x, c.y);
    return cr === r - 1 && ringDist(c.x, c.y, x, y) === 1;
  });
  if (!ok) return `须先在第${r - 1}圈与城域相连的乡村，才能向外扩到第${r}圈`;
  return null;
}

export function ownerHue(owner: string) {
  let h = 2166136261;
  for (let i = 0; i < owner.length; i += 1) h = Math.imul(h ^ owner.charCodeAt(i), 16777619);
  return (h >>> 0) % 360;
}

export function ownerColor(owner: string, alpha = 0.42) {
  return `hsla(${ownerHue(owner)}, 62%, 48%, ${alpha})`;
}
