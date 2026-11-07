import type { Card, City, World } from "../types";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function stubCard(c: Card): Card {
  return {
    ...c,
    cityId: c.listedWinston ? c.cityId : "",
    campaigns: c.listedWinston ? c.campaigns : [],
    squadId: undefined,
    marchId: undefined,
    jobId: undefined,
  };
}

function hideCity(city: City): City {
  return {
    ...city,
    name: city.systemRank
      ? (city.systemRank === "metro" ? "系统都市" : city.systemRank === "city" ? "系统城市" : "系统小镇")
      : city.npc ? `未知聚落·${city.tribeLevel || 1}级` : "他人城邦",
    buildings: {},
    plots: [],
    wars: [],
    buildMult: {},
    frontage: 0,
    systemRank: city.systemRank,
  };
}

/** 不属于你的地块不给细目。进城只看见本城卡。全图加载也不展示别人的名册。 */
export function veilWorld(world: World, viewer: string, cityId: string | null): World {
  const w = clone(world);
  if (!viewer) {
    w.cards = {};
    w.squads = {};
    for (const id of Object.keys(w.cities)) w.cities[id] = hideCity(w.cities[id]);
    return w;
  }

  const friends = new Set<string>([viewer]);
  const gid = w.memberOf?.[viewer];
  if (gid && w.guilds?.[gid]) for (const m of w.guilds[gid].members) friends.add(m);
  for (const id of Object.keys(w.cities)) {
    if (!friends.has(w.cities[id].owner)) w.cities[id] = hideCity(w.cities[id]);
  }

  const keep: Record<string, Card> = {};
  for (const listing of Object.values(w.listings)) {
    const card = world.cards[listing.cardId];
    if (card) keep[card.id] = stubCard(card);
  }
  for (const card of Object.values(w.cards)) {
    if (card.owner !== viewer) continue;
    if (card.marchId || (cityId && card.cityId === cityId)) keep[card.id] = card;
  }
  w.cards = keep;

  for (const id of Object.keys(w.squads)) {
    if (w.squads[id].owner !== viewer) delete w.squads[id];
  }
  for (const march of Object.values(w.marches)) {
    if (march.owner === viewer) continue;
    march.personIds = [];
    march.shipIds = [];
    march.squadId = "";
  }
  return w;
}

export function ownsTile(world: World, viewer: string, x: number, y: number): boolean {
  const city = Object.values(world.cities).find((c) => c.x === x && c.y === y);
  return Boolean(city && city.owner === viewer);
}
