import type { BuildingId, City, CityPlot } from "../types";

export function workLevel(p: CityPlot) {
  if (!p.building) return 0;
  return p.level ?? 1;
}

export function copiesOf(city: City, bid: BuildingId): CityPlot[] {
  return (city.plots || []).filter((p) => p.building === bid);
}

export function totalLevel(city: City, bid: BuildingId): number {
  const copies = copiesOf(city, bid);
  if (copies.length) return copies.reduce((n, p) => n + workLevel(p), 0);
  return city.buildings[bid]?.level || 0;
}

export function highestLevel(city: City, bid: BuildingId): number {
  const copies = copiesOf(city, bid);
  if (copies.length) return Math.max(0, ...copies.map(workLevel));
  return city.buildings[bid]?.level || 0;
}

export function plotJobs(city: City): CityPlot[] {
  return (city.plots || []).filter((p) => p.job);
}

export function rebuildBuildings(city: City) {
  const next: City["buildings"] = {};
  for (const p of city.plots || []) {
    if (!p.building) continue;
    const cur = next[p.building] || { level: 0, wars: [] };
    cur.level += workLevel(p);
    if (p.wars?.length) cur.wars = [...cur.wars, ...p.wars];
    if (p.job && !cur.job) cur.job = p.job;
    next[p.building] = cur;
  }
  city.buildings = next;
}
