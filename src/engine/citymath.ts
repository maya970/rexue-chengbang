import type { BuildingId, Card, City, World } from "../types";
import { BUILDINGS } from "./catalog";

export function buildingCount(city: City): number {
  return Object.values(city.buildings).reduce((n, b) => n + (b?.level || 0), 0);
}

export function citizensOf(city: City, world: World): number {
  let n = 0;
  for (const [id, b] of Object.entries(city.buildings)) {
    if (!b) continue;
    n += (BUILDINGS[id as BuildingId]?.citizens || 0) * b.level;
  }
  n += Object.values(world.cards).filter((c) => c.cityId === city.id && c.kind === "person" && c.role === "citizen" && !c.marchId).length;
  return n;
}

export function recruitCapOf(city: City): number {
  let n = 2;
  for (const [id, b] of Object.entries(city.buildings)) {
    if (!b) continue;
    n += (BUILDINGS[id as BuildingId]?.recruit || 0) * b.level;
  }
  return n;
}

export function worksOf(city: City, world: World): number {
  let n = city.wars.length;
  for (const [id, b] of Object.entries(city.buildings)) {
    if (!b) continue;
    n += (BUILDINGS[id as BuildingId]?.works || 0) * b.level + b.wars.length;
  }
  n += Object.values(world.cards).filter((c) => c.cityId === city.id && c.kind === "slave").length;
  return n;
}

export function livingPeople(world: World, owner: string, cityId?: string): Card[] {
  return Object.values(world.cards).filter(
    (c) => c.owner === owner && (c.kind === "person" || c.kind === "slave") && (!cityId || (c.cityId === cityId && !c.marchId)),
  );
}

export function garrisonPeople(world: World, cityId: string): Card[] {
  return Object.values(world.cards).filter((c) => c.cityId === cityId && !c.marchId && (c.kind === "person" || c.kind === "slave"));
}

export function garrisonShips(world: World, cityId: string): Card[] {
  return Object.values(world.cards).filter((c) => c.cityId === cityId && !c.marchId && c.kind === "ship");
}

export function recruitableCount(world: World, cityId: string): number {
  return Object.values(world.cards).filter((c) => c.cityId === cityId && c.kind === "person").length;
}
