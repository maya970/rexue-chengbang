import type { BuildingId, Card, City, RoleId, World } from "../types";
import { BUILDINGS, ROLES } from "./catalog";

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
  const temple = city.buildings.temple?.level || 0;
  let n = city.wars.length * (1 + temple);
  for (const [id, b] of Object.entries(city.buildings)) {
    if (!b) continue;
    n += (BUILDINGS[id as BuildingId]?.works || 0) * b.level + b.wars.length;
  }
  n += Object.values(world.cards).filter((c) => c.cityId === city.id && c.kind === "slave").length;
  return n;
}

export function buildSlotsOf(city: City): number {
  return 1 + Math.floor((city.buildings.agora?.level || 0) / 4);
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

export function roleCountOf(world: World, cityId: string, role: RoleId): number {
  return Object.values(world.cards).filter((c) => c.cityId === cityId && c.role === role).length;
}

/** 建筑物等级决定该职人物卡上限。没有对应建筑则为 0。 */
export function roleCapOf(city: City, role: RoleId): number {
  const def = ROLES[role];
  if (!def?.capPerLevel || !def.building) return 99;
  const lv = city.buildings[def.building]?.level || 0;
  return lv * def.capPerLevel;
}
