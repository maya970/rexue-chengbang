import { berthOf, byIds, mintCard, slowest, uniqueId } from "./cards";
import { AR_FEE_ADDR, BARE_BUILD_MULT, BUILDINGS, COLONIZE_COST, MISSION_NAME, ROLES, scaleTime, splitWinston, SUPPLY_PER_SLAVE } from "./catalog";
import { buildSlotsOf, citizensOf, garrisonPeople, garrisonShips, homeOf, recruitCapOf, recruitableCount, roleCapOf, roleCountOf, worksOf } from "./citymath";
import { resolveFight } from "./combat";
import { canColonize, canFound, chartOf, CHART, cityIdAt, isWater, npcAt, npcPower, respawnMs, terrainAt } from "./map";
import { marchSeconds, planPath, posAt, timeAtIndex } from "./path";
import { canBuildOn, ensureCityPlots, findEmptyPlot, findPlotFor, plotTimeMult, seedCityPlots } from "./plots";
import { highestLevel, rebuildBuildings, workLevel } from "./works";
import {
  bumpPeak,
  canFoundVillage,
  cityLevelCap,
  hamletOf,
  isHamlet,
  seatCity,
  SETTLE_COST,
  SITE_UPGRADE,
} from "./hamlets";
import {
  adjacentClaimed,
  alliesOf,
  claimOwner,
  claimTile,
  chartReachError,
  claimsGap,
  createGuild,
  ensureGuildState,
  ensureSystemNear,
  isAllyClaim,
  isPlayerClaim,
  inviteGuild,
  joinGuild,
  kickGuild,
  leaveGuild,
  unclaimTile,
} from "./realm";
import { buildMultAt, empireTimeFactor, frontageAt, slaveCostFor, workersFor } from "./site";
import { u32 } from "./hash";
import type { BattleReport, BuildingId, Campaign, Card, City, Command, March, MarketPair, RoleId, Squad, TrackedBatch, TxProof, World, WorldCheckpoint } from "../types";

function emptyWorld(): World {
  return {
    cities: {}, cards: {}, squads: {}, marches: {}, listings: {}, reports: [], skipped: [],
    resolvedClash: {}, gone: {}, raidDone: {}, spentPays: {}, claims: {}, guilds: {}, memberOf: {},
    guildBanUntil: {}, fallen: {}, simAt: 0, digest: "",
  };
}

function hydrateWorld(world: World): World {
  world.cities ||= {};
  world.cards ||= {};
  world.squads ||= {};
  world.marches ||= {};
  world.listings ||= {};
  world.reports ||= [];
  world.skipped ||= [];
  world.resolvedClash ||= {};
  world.gone ||= {};
  world.raidDone ||= {};
  world.spentPays ||= {};
  world.fallen ||= {};
  ensureGuildState(world);
  sweepFallen(world);
  for (const r of world.reports) {
    r.rounds ||= [];
    r.deadNames ||= [];
  }
  for (const city of Object.values(world.cities)) {
    city.owner ||= "";
    city.name ||= "无名";
    city.buildings ||= {};
    city.plots ||= [];
    city.wars ||= [];
    city.buildMult ||= {};
    city.hamlet ||= city.parentId ? "village" : "city";
    bumpPeak(city);
  }
  for (const card of Object.values(world.cards)) {
    card.homeCityId ||= card.cityId;
    const sit = world.cities[card.homeCityId];
    if (sit && isHamlet(sit) && sit.parentId && world.cities[sit.parentId]) {
      card.homeCityId = sit.parentId;
    }
  }
  return world;
}

function cloneWorld(w: World): World {
  return hydrateWorld(JSON.parse(JSON.stringify(w || {})) as World);
}

function markWar(city: City | undefined, war: Campaign) {
  if (!city) return;
  if (!city.wars.some((x) => x.id === war.id)) city.wars.push(war);
  for (const b of Object.values(city.buildings)) {
    if (b && !b.wars.some((x) => x.id === war.id)) b.wars.push(war);
  }
  for (const p of city.plots || []) {
    if (!p.building) continue;
    p.wars ||= [];
    if (!p.wars.some((x) => x.id === war.id)) p.wars.push(war);
  }
}

function fillNpcGarrison(world: World, city: City) {
  if (Object.values(world.cards).some((c) => c.cityId === city.id)) return;
  const site = npcAt(city.x, city.y);
  if (!site && !city.systemRank) return;
  const level = site?.level || city.tribeLevel || 4;
  const p = site ? npcPower(site) : 20 + level * 10;
  const n = Math.max(4, Math.min(22, Math.floor(2 + level * 1.2)));
  const roles: RoleId[] =
    site?.kind === "pirates" ? ["epibatai", "trierarch", "trireme", "transport"] : ["hoplite", "peltast", "toxotes", "slave"];
  for (let i = 0; i < n; i += 1) {
    const role = roles[i % roles.length];
    const card = mintCard({
      id: uniqueId(["npc", String(city.x), String(city.y), String(i), role]),
      role,
      owner: city.owner,
      cityId: city.id,
      bornAt: 0,
      bornTx: "npc",
    });
    const wars = level + (p % 3);
    for (let w = 0; w < wars; w += 1) {
      card.campaigns.push({ id: `npcwar:${city.id}:${w}`, name: `${level}级边衅`, time: 0 });
    }
    world.cards[card.id] = card;
  }
}

function makeNpcCity(world: World, x: number, y: number, garrison = false) {
  const site = npcAt(x, y);
  if (!site) return;
  const id = cityIdAt(x, y);
  if (isPlayerClaim(world, x, y) && !world.cities[id]?.npc) return;
  if (world.cities[id]?.systemRank) {
    if (garrison) fillNpcGarrison(world, world.cities[id]);
    return;
  }
  const gone = world.gone[id];
  if (gone && gone.respawnAt > (world.simAt || 0) && !world.cities[id]) return;
  if (gone) delete world.gone[id];
  if (!world.cities[id]) {
    world.cities[id] = {
      id,
    owner: `npc:${site.kind}`,
    name: site.name,
    x,
    y,
    buildings: {
        acropolis: { level: Math.min(8, 1 + Math.floor(site.level / 3)), wars: [] },
        oikos: { level: Math.min(6, 1 + Math.floor(site.level / 4)), wars: [] },
        wall: { level: Math.min(3, site.kind === "polis" ? 3 : Math.max(1, Math.floor(site.level / 5))), wars: [] },
        barracks: { level: 1, wars: [] },
        harbor: isWater(terrainAt(x, y)) || site.kind === "pirates" ? { level: 1, wars: [] } : undefined,
        shipyard: site.kind === "pirates" ? { level: 2, wars: [] } : undefined,
      },
    foundedAt: 0,
    npc: true,
      frontage: frontageAt(x, y),
      buildMult: buildMultAt(x, y),
      wars: [],
      plots: [],
      tribeLevel: site.level,
      peakLevel: site.level,
      hamlet: "city",
    };
    seedCityPlots(world.cities[id], (Object.keys(world.cities[id].buildings) as BuildingId[]).filter((bid) => (world.cities[id].buildings[bid]?.level || 0) > 0));
  }
  if (garrison) fillNpcGarrison(world, world.cities[id]);
}

function ensureNpcsInChart(world: World, cx: number, cy: number) {
  const ox = cx * CHART;
  const oy = cy * CHART;
  for (let y = oy; y < oy + CHART; y += 1) {
    for (let x = ox; x < ox + CHART; x += 1) {
      makeNpcCity(world, x, y);
    }
  }
}

function ensureNpcsNear(world: World, x: number, y: number) {
  const c = chartOf(x, y);
  ensureNpcsInChart(world, c.cx, c.cy);
}

function finishJobs(world: World, city: City, t: number) {
  let done = false;
  for (const p of city.plots || []) {
    if (p.job && p.job.finishAt <= t) {
      for (const id of p.job.workerIds || []) {
        if (world.cards[id]) world.cards[id].jobId = undefined;
      }
      p.level = p.job.to;
      delete p.job;
      done = true;
    }
  }
  for (const [bid, b] of Object.entries(city.buildings)) {
    if (b?.job && b.job.finishAt <= t) {
      for (const id of b.job.workerIds || []) {
        if (world.cards[id]) world.cards[id].jobId = undefined;
      }
      delete b.job;
      city.buildings[bid as BuildingId] = b;
      done = true;
    }
  }
  if (done) {
    rebuildBuildings(city);
    bumpPeak(city);
  }
}

function tickCity(world: World, city: City, t: number) {
  ensureCityPlots(city);
  finishJobs(world, city, t);
}

function cityAt(world: World, x: number, y: number): City | undefined {
  return world.cities[cityIdAt(x, y)];
}

function ownerScale(world: World, owner: string) {
  const cities = Object.values(world.cities).filter((c) => c.owner === owner && !c.npc).length;
  const people = Object.values(world.cards).filter((c) => c.owner === owner && c.kind === "person").length;
  const slaves = Object.values(world.cards).filter((c) => c.owner === owner && c.kind === "slave").length;
  return empireTimeFactor(cities, people, slaves);
}

function idleSlaves(world: World, cityId: string): Card[] {
  return Object.values(world.cards)
    .filter((c) => c.cityId === cityId && c.kind === "slave" && !c.marchId && !c.jobId && !c.listedWinston)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function idleSupply(world: World, cityId: string): Card[] {
  return Object.values(world.cards)
    .filter((c) => c.cityId === cityId && c.kind === "supply" && !c.marchId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function idleWorkers(world: World, cityId: string, owner: string): Card[] {
  return Object.values(world.cards)
    .filter((c) => c.cityId === cityId && c.owner === owner && c.kind === "person" && !c.marchId && !c.jobId && !c.listedWinston)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function idleKindCount(world: World, cityId: string, kind: "slave" | "supply"): number {
  return Object.values(world.cards).filter((c) => c.cityId === cityId && c.kind === kind && !c.marchId && !c.jobId && !c.listedWinston).length;
}

function consumeKind(world: World, cityId: string, kind: "slave" | "supply", n: number): boolean {
  const pool = Object.values(world.cards)
    .filter((c) => c.cityId === cityId && c.kind === kind && !c.marchId && !c.jobId && !c.listedWinston)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length < n) return false;
  for (let i = 0; i < n; i += 1) delete world.cards[pool[i].id];
  return true;
}

function takeSettlerCosts(world: World, cityId: string, slaves: number, supplies: number): boolean {
  if (idleKindCount(world, cityId, "slave") < slaves || idleKindCount(world, cityId, "supply") < supplies) return false;
  return consumeKind(world, cityId, "slave", slaves) && consumeKind(world, cityId, "supply", supplies);
}

function consumeMaterials(world: World, cityId: string, n: number): boolean {
  const goods = idleSupply(world, cityId);
  const slaves = idleSlaves(world, cityId);
  if (goods.length + slaves.length < n) return false;
  let left = n;
  for (const c of goods) {
    if (left <= 0) break;
    delete world.cards[c.id];
    left -= 1;
  }
  for (const c of slaves) {
    if (left <= 0) break;
    delete world.cards[c.id];
    left -= 1;
  }
  return left <= 0;
}

function lockWorkers(world: World, workers: Card[], jobId: string) {
  for (const c of workers) c.jobId = jobId;
}

function returnHome(world: World, ids: string[], cityId: string | undefined) {
  for (const id of ids) {
    const card = world.cards[id];
    if (!card) continue;
    card.marchId = undefined;
    card.cityId = cityId || card.homeCityId || card.cityId;
  }
}

function parkAt(world: World, ids: string[], city: City) {
  for (const id of ids) {
    const card = world.cards[id];
    if (!card) continue;
    card.marchId = undefined;
    card.cityId = city.id;
    card.owner = city.owner;
  }
}

/** 迁籍：开辟城邦、建成乡村的人改编制。出征驻扎不走这里。 */
function transferHome(world: World, ids: string[], city: City) {
  parkAt(world, ids, city);
  for (const id of ids) {
    const card = world.cards[id];
    if (card) card.homeCityId = city.id;
  }
}

function buryFromReports(world: World) {
  if (!world.fallen) world.fallen = {};
  for (const r of world.reports || []) {
    if (r.deadIds?.length) {
      for (const id of r.deadIds) {
        const c = world.cards[id];
        if (!c) continue;
        world.fallen[id] = { name: c.name, owner: c.owner, at: r.time };
        delete world.cards[id];
      }
      continue;
    }
    if (!r.deadNames?.length) continue;
    const names = new Set(r.deadNames);
    const sides = new Set([r.attacker, r.defender].filter(Boolean));
    for (const c of Object.values(world.cards)) {
      if (!names.has(c.name) || !sides.has(c.owner)) continue;
      const inThisWar = (c.campaigns || []).some((w) => w.id === r.id || w.id.startsWith(`${r.id}:`));
      if (!inThisWar) continue;
      world.fallen[c.id] = { name: c.name, owner: c.owner, at: r.time };
      delete world.cards[c.id];
    }
  }
}

function sweepFallen(world: World) {
  if (!world.fallen) world.fallen = {};
  buryFromReports(world);
  for (const id of Object.keys(world.fallen)) {
    delete world.cards[id];
  }
  for (const id of Object.keys(world.listings || {})) {
    const listing = world.listings[id];
    if (!listing) continue;
    if (world.fallen[listing.cardId] || !world.cards[listing.cardId]) delete world.listings[id];
  }
  for (const sq of Object.values(world.squads || {})) {
    sq.personIds = sq.personIds.filter((id) => world.cards[id] && !world.fallen[id]);
    sq.shipIds = sq.shipIds.filter((id) => world.cards[id] && !world.fallen[id]);
  }
}

function eraseCards(world: World, cards: Card[]) {
  if (!world.fallen) world.fallen = {};
  const seen = new Set<string>();
  for (const c of cards) {
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    world.fallen[c.id] = { name: c.name, owner: c.owner, at: world.simAt || 0 };
    delete world.cards[c.id];
  }
  sweepFallen(world);
}

function clashKey(a: string, b: string, tile: string): string {
  return [a, b].sort().join("|") + "@" + tile;
}

function mintSlaves(world: World, n: number, owner: string, cityId: string, t: number, entropy: string) {
  const count = Math.max(0, Math.min(12, n));
  for (let i = 0; i < count; i += 1) {
    const card = mintCard({
      id: uniqueId(["slave", entropy, cityId, String(i), String(t)]),
      role: "slave",
      owner,
      cityId,
      bornAt: t,
      bornTx: entropy,
    });
    world.cards[card.id] = card;
  }
  return count;
}

function mintSupply(world: World, n: number, owner: string, cityId: string, t: number, entropy: string) {
  const count = Math.max(0, Math.min(16, n));
  for (let i = 0; i < count; i += 1) {
    const card = mintCard({
      id: uniqueId(["supply", entropy, cityId, String(i), String(t)]),
      role: "supply",
      owner,
      cityId,
      bornAt: t,
      bornTx: entropy,
    });
    world.cards[card.id] = card;
  }
  return count;
}

function corridorBlocked(world: World, tiles: { x: number; y: number }[], owner: string, destX: number, destY: number): string | null {
  const friends = alliesOf(world, owner);
  for (let i = 1; i < tiles.length; i += 1) {
    const p = tiles[i];
    if (p.x === destX && p.y === destY) continue;
    const c = cityAt(world, p.x, p.y);
    if (c && !friends.has(c.owner)) {
      return c.npc
        ? `路上有野蛮人 ${c.name} (${p.x},${p.y})，须先进攻清理才能连通`
        : isHamlet(c)
          ? `路上有敌方乡村 ${c.name} (${p.x},${p.y})，须先占领或毁灭才能开路，劫掠不能拆掉它`
          : `路上有敌方城邦 ${c.name} (${p.x},${p.y})，须先占领或毁灭`;
    }
    if (terrainAt(p.x, p.y) === "sea") continue;
    if (!isAllyClaim(world, owner, p.x, p.y)) {
      return `须从已连通邻格一格格推进 (${p.x},${p.y})。公会成员的连通可共享`;
    }
  }
  return null;
}

function stripEmptyClaimsAround(world: World, x: number, y: number) {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const tx = x + dx;
    const ty = y + dy;
    if (!isPlayerClaim(world, tx, ty)) continue;
    const c = cityAt(world, tx, ty);
    if (c && !c.npc) continue;
    unclaimTile(world, tx, ty);
  }
}

function damageBuildings(city: City, want: number, soldiers: number, citizens: number, bitsWant: number) {
  const ratio = soldiers / Math.max(1, citizens);
  const cap = Math.max(0, Math.floor(buildingLevels(city) * Math.min(1, ratio / 0.6)));
  const n = Math.min(want, cap, bitsWant);
  const plots = (city.plots || []).filter((p) => p.building && workLevel(p) > 0);
  plots.sort((a, b) => (a.building || "").localeCompare(b.building || "") || a.id.localeCompare(b.id));
  let left = n;
  for (const p of plots) {
    if (left <= 0) break;
    const lv = workLevel(p);
    const cut = Math.min(lv, left);
    p.level = lv - cut;
    left -= cut;
    if ((p.level || 0) <= 0) {
      p.building = undefined;
      p.level = 0;
      delete p.job;
    }
  }
  rebuildBuildings(city);
  return n - left;
}

function buildingLevels(city: City): number {
  return Object.values(city.buildings).reduce((n, b) => n + (b?.level || 0), 0);
}

function destroyCity(world: World, city: City, t: number) {
  for (const kid of Object.values(world.cities).filter((c) => c.parentId === city.id)) {
    destroyCity(world, kid, t);
  }
  world.gone[city.id] = {
    at: t,
    respawnAt: city.npc ? t + respawnMs(city.tribeLevel || 1) : Number.MAX_SAFE_INTEGER,
    level: city.tribeLevel || 1,
  };
  for (const c of Object.values(world.cards)) {
    if (c.cityId === city.id && !c.marchId) delete world.cards[c.id];
  }
  delete world.cities[city.id];
}

function fightMarch(world: World, march: March, t: number, dest: City | undefined, field: boolean, foe?: March) {
  const atkPeople = byIds(world.cards, march.personIds).filter((c) => c.kind !== "ship");
  const atkShips = byIds(world.cards, march.shipIds).filter((c) => c.kind === "ship");
  let defPeople: Card[] = [];
  let defShips: Card[] = [];
  let defender = "荒野";
  let frontage = frontageAt(march.toX, march.toY);
  if (field && foe) {
    defPeople = byIds(world.cards, foe.personIds).filter((c) => c.kind !== "ship");
    defShips = byIds(world.cards, foe.shipIds).filter((c) => c.kind === "ship");
    defender = foe.owner;
    const pos = posAt(march.path, march.startAt, march.arriveAt, t);
    frontage = frontageAt(pos.x, pos.y);
  } else if (dest) {
    if (dest.npc) fillNpcGarrison(world, dest);
    defPeople = garrisonPeople(world, dest.id);
    defShips = garrisonShips(world, dest.id);
    defender = dest.owner;
    frontage = dest.frontage;
  }
  const pos = field ? posAt(march.path, march.startAt, march.arriveAt, t) : { x: march.toX, y: march.toY };
  const temple = dest && !field ? (dest.buildings.temple?.level || 0) : 0;
  const wallBonus = dest && !field ? (dest.buildings.wall?.level || 0) : 0;
  const fight = resolveFight({
    id: field ? `field:${clashKey(march.id, foe?.id || "x", `${pos.x},${pos.y}`)}` : `btl:${march.id}`,
    entropy: march.entropy,
    time: t,
    attacker: march.owner,
    defender,
    x: pos.x,
    y: pos.y,
    atkPeople,
    defPeople,
    atkShips,
    defShips,
    frontage,
    defFrontage: frontage + wallBonus,
    naval: march.naval || Boolean(foe?.naval),
    field,
    warName: field ? "野外遭遇" : MISSION_NAME[march.mission],
    defHold: temple * 0.04,
  });
  eraseCards(world, fight.dead);
  world.reports.unshift(fight.report);
  if (dest) markWar(dest, { id: fight.report.id, name: fight.report.title, time: t });
  return fight;
}

function applyAftermath(world: World, march: March, dest: City, t: number, soldiers: number) {
  const origin = world.cities[march.fromCityId];
  const cit = citizensOf(dest, world);
  const works = worksOf(dest, world);
  const seed = march.entropy + march.mission;
  const bitsWant = 1 + (seed.length % 7);
  if (march.mission === "plunder") {
    const hurt = damageBuildings(dest, Math.max(1, Math.floor(buildingLevels(dest) * 0.2)), soldiers, cit, bitsWant + 1);
    const slaves = mintSlaves(world, Math.max(1, Math.floor(works * 0.1) + (hurt > 0 ? 1 : 0)), march.owner, origin?.id || dest.id, t, seed);
    const supplies = mintSupply(world, Math.max(1, Math.floor(works * 0.16) + 1), march.owner, origin?.id || dest.id, t, seed + "g");
    world.reports[0].slaves = slaves;
    world.reports[0].supplies = supplies;
    world.reports[0].aftermath = "plunder";
    world.reports[0].rounds.push({ key: "plunder", params: { slaves, supplies, hurt }, title: "劫掠", text: `带走奴隶卡 ${slaves}、物资卡 ${supplies}。因兵民悬殊，只毁去 ${hurt} 级建筑。城未易主。` });
    if (march.owner.startsWith("npc:")) {
      stripEmptyClaimsAround(world, dest.x, dest.y);
      world.reports[0].rounds.push({ key: "barbCut", params: {}, title: "切断连通", text: "野蛮人扫过周边空地，已连通的格子被切断，之后可能在未连通处刷新。" });
    }
    returnHome(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), origin?.id);
    return;
  }
  if (march.mission === "occupy") {
    dest.owner = march.owner;
    dest.npc = false;
    if (isHamlet(dest)) dest.parentId = undefined;
    parkAt(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), dest);
    claimTile(world, march.owner, dest.x, dest.y, true);
    world.reports[0].aftermath = "occupy";
    world.reports[0].rounds.push({ key: "occupy", params: { name: dest.name }, title: "占领", text: `${dest.name} 易主。系统城不能毁灭，可占领、劫掠、屠城。` });
    return;
  }
  if (march.mission === "massacre") {
    const hurt = damageBuildings(dest, Math.max(2, Math.floor(buildingLevels(dest) * 0.55)), soldiers, cit, bitsWant + 4);
    dest.owner = march.owner;
    dest.npc = false;
    if (isHamlet(dest)) dest.parentId = undefined;
    const slaves = mintSlaves(world, Math.max(2, Math.floor(works * 0.2) + hurt), march.owner, dest.id, t, seed);
    const supplies = mintSupply(world, Math.max(2, Math.floor(works * 0.28) + hurt), march.owner, dest.id, t, seed + "g");
    parkAt(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), dest);
    world.reports[0].slaves = slaves;
    world.reports[0].supplies = supplies;
    world.reports[0].aftermath = "massacre";
    world.reports[0].rounds.push({ key: "massacre", params: { hurt, slaves, supplies }, title: "屠城", text: `城易主。毁建筑 ${hurt} 级，得奴隶卡 ${slaves}、物资卡 ${supplies}。兵少则毁不了太多。` });
    claimTile(world, march.owner, dest.x, dest.y, true);
    return;
  }
  if (march.mission === "destroy") {
    if (dest.systemRank) {
      dest.owner = march.owner;
      dest.npc = false;
      parkAt(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), dest);
      claimTile(world, march.owner, dest.x, dest.y, true);
      world.reports[0].aftermath = "occupy";
      world.reports[0].rounds.push({ key: "noDestroy", params: { name: dest.name }, title: "不能毁灭", text: `${dest.name} 是系统城，已改为占领。` });
      return;
    }
    const slaves = mintSlaves(world, Math.max(1, Math.floor(works * 0.14)), march.owner, origin?.id || dest.id, t, seed);
    const supplies = mintSupply(world, Math.max(1, Math.floor(works * 0.12)), march.owner, origin?.id || dest.id, t, seed + "g");
    world.reports[0].slaves = slaves;
    world.reports[0].supplies = supplies;
    world.reports[0].aftermath = "destroy";
    world.reports[0].rounds.push({ key: "destroy", params: { name: dest.name, slaves, supplies }, title: "毁灭", text: `${dest.name} 从地图上抹去。奴隶卡 ${slaves}、物资卡 ${supplies} 带回。` });
    returnHome(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), origin?.id);
    claimTile(world, march.owner, dest.x, dest.y, true);
    destroyCity(world, dest, t);
  }
}

function resolveArrival(world: World, march: March, t: number) {
  const dest = cityAt(world, march.toX, march.toY);
  if (dest?.npc) fillNpcGarrison(world, dest);
  const origin = world.cities[march.fromCityId];
  const still = [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]);

  if (march.mission === "scout") {
    if (dest && isHamlet(dest) && dest.owner !== march.owner && !alliesOf(world, march.owner).has(dest.owner)) {
      const fight = fightMarch(world, march, t, dest, false);
      const soldiers = still.filter((id) => world.cards[id] && world.cards[id].kind !== "ship").length;
      if (fight.report.win && world.cities[dest.id]) {
        applyAftermath(world, { ...march, mission: "plunder" }, dest, t, soldiers);
        fight.report.aftermath = "plunder";
        fight.report.rounds.push({
          key: "scoutRaidVillage",
          params: { name: dest.name },
          title: "抢劫乡村",
          text: `侦察遇乡村 ${dest.name}，已按劫掠处理。要占地须直接进攻占领。`,
        });
      } else {
        returnHome(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), origin?.id);
        fight.report.rounds.push({ key: "loseReturn", params: {}, title: "回报", text: "抢劫乡村失利，幸存者已返回。" });
      }
      delete world.marches[march.id];
      return;
    }
    const taken = claimOwner(world, march.toX, march.toY);
    let grabbed = false;
    if (!dest && terrainAt(march.toX, march.toY) !== "sea") {
      const nextTo = adjacentClaimed(world, march.owner, march.toX, march.toY) || isAllyClaim(world, march.owner, march.toX, march.toY);
      if (nextTo) {
        grabbed = isAllyClaim(world, march.owner, march.toX, march.toY) || claimTile(world, march.owner, march.toX, march.toY, true);
      }
    }
    const scoutKey = dest
      ? "scoutCity"
      : terrainAt(march.toX, march.toY) === "sea"
        ? "scoutSea"
        : grabbed && taken && taken !== march.owner
          ? "scoutGrab"
          : grabbed
            ? "scoutOpen"
            : "scoutBlocked";
    const report: BattleReport = {
      id: `scout:${march.id}`,
      time: t,
      title: "侦察回报",
      code: "scout",
      attacker: march.owner,
      defender: dest?.owner || taken || "__wild__",
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: Boolean(grabbed || dest),
      rounds: [
        {
          key: scoutKey,
          params: dest
            ? { wars: dest.wars.length, cit: citizensOf(dest, world), people: garrisonPeople(world, dest.id).length, ships: garrisonShips(world, dest.id).length, width: dest.frontage }
            : {},
          title: "斥候",
          text: dest
            ? `此处已有城邦，侦察不能夺格。城墙履历 ${dest.wars.length} 场。驻军 ${garrisonPeople(world, dest.id).length}，舰只 ${garrisonShips(world, dest.id).length}。要占地必须进攻。`
            : scoutKey === "scoutGrab"
              ? "空地已从他人手中夺下，此格现属你。"
              : scoutKey === "scoutOpen"
                ? "空地已连通，此格现属你。"
                : scoutKey === "scoutSea"
                  ? "海域不能抢格。"
                  : "未能夺下此格。",
        },
      ],
      deadNames: [],
    };
    world.reports.unshift(report);
    returnHome(world, still, origin?.id);
    delete world.marches[march.id];
    return;
  }

  if (march.mission === "reinforce") {
    const ownCity = dest && dest.owner === march.owner ? dest : undefined;
    if (ownCity) parkAt(world, still, ownCity);
    else returnHome(world, still, origin?.id);
    world.reports.unshift({
      id: `rf:${march.id}`,
      time: t,
      title: ownCity ? "增援抵达" : "增援折返",
      code: ownCity ? "reinforceOk" : "reinforceBack",
      attacker: march.owner,
      defender: dest?.name || "__enroute__",
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: Boolean(ownCity),
      rounds: [{
        key: ownCity ? "reinforceIn" : "reinforceReturn",
        params: { n: still.length, name: ownCity?.name || "" },
        title: "回报",
        text: ownCity ? `${still.length} 人进入 ${ownCity.name}。` : "目标不是自己的城，军团已返回出发城。",
      }],
      deadNames: [],
      aftermath: "reinforce",
    });
    delete world.marches[march.id];
    return;
  }

  if (march.mission === "colonize" && !dest) {
    if (!canColonize(terrainAt(march.toX, march.toY)) || (world.gone[cityIdAt(march.toX, march.toY)]?.respawnAt || 0) > t) {
      returnHome(world, still, origin?.id);
      world.skipped.push(`${march.id}:殖民地点不可建城`);
      world.reports.unshift({
        id: `colfail:${march.id}`,
        time: t,
        title: "殖民失败",
        code: "colonizeFail",
        attacker: march.owner,
        defender: "__wild__",
        x: march.toX,
        y: march.toY,
        naval: march.naval,
        field: false,
        win: false,
        rounds: [{ key: "colonizeFailText", params: {}, title: "回报", text: "此地不能建城，军团已返回出发城。" }],
        deadNames: [],
        aftermath: "colonize",
      });
      delete world.marches[march.id];
      return;
    }
    if (claimOwner(world, march.toX, march.toY) && claimOwner(world, march.toX, march.toY) !== march.owner) {
      returnHome(world, still, origin?.id);
      world.skipped.push(`${march.id}:此地已被他人连通`);
      delete world.marches[march.id];
      return;
    }
    if (!origin || !takeSettlerCosts(world, origin.id, COLONIZE_COST.slaves, COLONIZE_COST.supplies)) {
      returnHome(world, still, origin?.id);
      world.skipped.push(`${march.id}:抵达时奴隶或物资不足`);
      world.reports.unshift({
        id: `colfail:${march.id}`,
        time: t,
        title: "殖民失败",
        code: "colonizeFail",
        attacker: march.owner,
        defender: "__wild__",
        x: march.toX,
        y: march.toY,
        naval: march.naval,
        field: false,
        win: false,
        rounds: [{ key: "colonizeFailText", params: {}, title: "回报", text: "抵达时出发城奴隶或物资不足，未扣资源，军团已返回。召回途中同样不扣。" }],
        deadNames: [],
        aftermath: "colonize",
      });
      delete world.marches[march.id];
      return;
    }
    const city: City = {
      id: cityIdAt(march.toX, march.toY),
      owner: march.owner,
      name: `殖民市 ${march.toX},${march.toY}`,
      hamlet: "city",
      x: march.toX,
      y: march.toY,
      buildings: {
        acropolis: { level: 1, wars: [] },
        oikos: { level: 1, wars: [] },
        ...(isWater(terrainAt(march.toX, march.toY)) ? { harbor: { level: 1, wars: [] } } : {}),
      },
      plots: [],
      foundedAt: t,
      npc: false,
      frontage: frontageAt(march.toX, march.toY),
      buildMult: buildMultAt(march.toX, march.toY),
      wars: [],
      peakLevel: 1,
    };
    world.cities[city.id] = city;
    seedCityPlots(city, isWater(terrainAt(march.toX, march.toY)) ? ["acropolis", "oikos", "harbor"] : ["acropolis", "oikos"]);
    bumpPeak(city);
    claimTile(world, march.owner, city.x, city.y);
    transferHome(world, still, city);
    world.reports.unshift({
      id: `col:${march.id}`,
      time: t,
      title: "殖民成功",
      code: "colonizeOk",
      attacker: march.owner,
      defender: "__wild__",
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: true,
      rounds: [{ key: "colonizeText", params: { name: city.name, slaves: COLONIZE_COST.slaves, supplies: COLONIZE_COST.supplies }, title: "开辟", text: `${city.name} 建立。消耗奴隶 ${COLONIZE_COST.slaves}、物资 ${COLONIZE_COST.supplies}，人物卡迁入新城。` }],
      deadNames: [],
      aftermath: "colonize",
    });
    delete world.marches[march.id];
    return;
  }

  if (march.mission === "settle" && !dest) {
    const parent = origin;
    const err = parent ? canFoundVillage(world, march.owner, parent, march.toX, march.toY) : "没有出发城";
    if (err) {
      returnHome(world, still, origin?.id);
      world.skipped.push(`${march.id}:${err}`);
      world.reports.unshift({
        id: `setfail:${march.id}`,
        time: t,
        title: "建村失败",
        code: "settleFail",
        attacker: march.owner,
        defender: "__wild__",
        x: march.toX,
        y: march.toY,
        naval: march.naval,
        field: false,
        win: false,
        rounds: [{ key: "settleFailText", params: { reason: err }, title: "回报", text: err }],
        deadNames: [],
        aftermath: "settle",
      });
      delete world.marches[march.id];
      return;
    }
    if (!parent || !takeSettlerCosts(world, parent.id, SETTLE_COST.slaves, SETTLE_COST.supplies)) {
      returnHome(world, still, origin?.id);
      world.skipped.push(`${march.id}:抵达时奴隶或物资不足`);
      world.reports.unshift({
        id: `setfail:${march.id}`,
        time: t,
        title: "建村失败",
        code: "settleFail",
        attacker: march.owner,
        defender: "__wild__",
        x: march.toX,
        y: march.toY,
        naval: march.naval,
        field: false,
        win: false,
        rounds: [{ key: "settleFailText", params: { reason: "抵达时奴隶或物资不足" }, title: "回报", text: "抵达时出发城奴隶或物资不足，未扣资源，军团已返回。" }],
        deadNames: [],
        aftermath: "settle",
      });
      delete world.marches[march.id];
      return;
    }
    const village: City = {
      id: cityIdAt(march.toX, march.toY),
      owner: march.owner,
      name: `乡村 ${march.toX},${march.toY}`,
      x: march.toX,
      y: march.toY,
      buildings: { acropolis: { level: 1, wars: [] }, oikos: { level: 1, wars: [] } },
      plots: [],
      foundedAt: t,
      npc: false,
      frontage: frontageAt(march.toX, march.toY),
      buildMult: buildMultAt(march.toX, march.toY),
      wars: [],
      hamlet: "village",
      parentId: parent!.id,
      peakLevel: 1,
    };
    world.cities[village.id] = village;
    seedCityPlots(village, ["acropolis", "oikos"]);
    claimTile(world, march.owner, village.x, village.y, false);
    transferHome(world, still, village);
    world.reports.unshift({
      id: `set:${march.id}`,
      time: t,
      title: "乡村建成",
      code: "settleOk",
      attacker: march.owner,
      defender: "__wild__",
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: true,
      rounds: [{ key: "settleText", params: { name: village.name, parent: parent!.name }, title: "开辟", text: `${village.name} 归属 ${parent!.name}，解锁城邦等级上限 +${2}。` }],
      deadNames: [],
      aftermath: "settle",
    });
    delete world.marches[march.id];
    return;
  }

  if (!dest) {
    if (march.owner.startsWith("npc:") && isPlayerClaim(world, march.toX, march.toY)) {
      unclaimTile(world, march.toX, march.toY);
      returnHome(world, still, origin?.id);
      world.reports.unshift({
        id: `barbcut:${march.id}`,
        time: t,
        title: "野蛮人切断连通",
        code: "barbCut",
        attacker: march.owner,
        defender: "__wild__",
        x: march.toX,
        y: march.toY,
        naval: march.naval,
        field: false,
        win: true,
        rounds: [{ key: "barbCut", params: {}, title: "切断连通", text: "未连通格子上的野蛮人冲进你的连通空地，此格连通已丢失。野蛮人仍会从没有连通的格子刷新。" }],
        deadNames: [],
        aftermath: "plunder",
      });
      delete world.marches[march.id];
      return;
    }
    returnHome(world, still, origin?.id);
    world.reports.unshift({
      id: `empty:${march.id}`,
      time: t,
      title: `${MISSION_NAME[march.mission]}无果`,
      code: "empty",
      attacker: march.owner,
      defender: "__wild__",
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: false,
      rounds: [{ key: "emptyText", params: { n: still.length, mission: march.mission }, title: "回报", text: `目标格没有城。${still.length} 人已返回出发城。` }],
      deadNames: [],
      aftermath: march.mission,
    });
    delete world.marches[march.id];
    return;
  }

  const friends = alliesOf(world, march.owner);
  const war = march.mission === "plunder" || march.mission === "massacre" || march.mission === "destroy" || march.mission === "occupy";
  if (war && friends.has(dest.owner)) {
    returnHome(world, still, origin?.id);
    world.reports.unshift({
      id: `ally:${march.id}`,
    time: t,
      title: dest.owner === march.owner ? "不能攻击自己" : "不能攻击公会",
      code: dest.owner === march.owner ? "noSelf" : "noGuild",
    attacker: march.owner,
      defender: dest.name,
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: false,
      rounds: [{
        key: dest.owner === march.owner ? "noSelfText" : "noGuildText",
        params: { name: dest.name },
        title: "回报",
        text: dest.owner === march.owner ? "不能攻击自己的城，军团已返回。" : "不能攻击同公会成员，军团已返回。",
      }],
      deadNames: [],
    });
    delete world.marches[march.id];
    return;
  }
  if (dest.owner === march.owner) {
    parkAt(world, still, dest);
    world.reports.unshift({
      id: `home:${march.id}`,
      time: t,
      title: "军团入城",
      code: "home",
      attacker: march.owner,
      defender: dest.name,
      x: march.toX,
      y: march.toY,
      naval: march.naval,
      field: false,
      win: true,
      rounds: [{ key: "homeText", params: { n: still.length, name: dest.name }, title: "回报", text: `${still.length} 人进入自己的 ${dest.name}。` }],
      deadNames: [],
    });
    delete world.marches[march.id];
    return;
  }

  const fight = fightMarch(world, march, t, dest, false);
  const soldiers = still.filter((id) => world.cards[id] && world.cards[id].kind !== "ship").length;
  if (fight.report.win && (march.mission === "plunder" || march.mission === "massacre" || march.mission === "destroy" || march.mission === "occupy")) {
    if (world.cities[dest.id]) applyAftermath(world, march, dest, t, soldiers);
  } else {
    returnHome(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), origin?.id);
    fight.report.rounds.push({ key: "loseReturn", params: {}, title: "回报", text: "失利，幸存者已返回出发城。" });
  }
  delete world.marches[march.id];
}

function findClashes(world: World, t: number): { a: March; b: March; time: number; tile: string }[] {
  const list = Object.values(world.marches);
  const out: { a: March; b: March; time: number; tile: string }[] = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.owner === b.owner) continue;
      if (alliesOf(world, a.owner).has(b.owner)) continue;
      const windowStart = Math.max(a.startAt, b.startAt);
      const windowEnd = Math.min(a.arriveAt, b.arriveAt, t);
      if (windowEnd <= windowStart) continue;
      const map = new Map<string, number[]>();
      a.path.forEach((p, idx) => {
        const k = `${p.x},${p.y}`;
        const arr = map.get(k) || [];
        arr.push(idx);
        map.set(k, arr);
      });
      for (let bi = 0; bi < b.path.length; bi += 1) {
        const p = b.path[bi];
        const k = `${p.x},${p.y}`;
        const aIdxs = map.get(k);
        if (!aIdxs) continue;
        for (const ai of aIdxs) {
          const ta = timeAtIndex(a.startAt, a.arriveAt, a.path.length, ai);
          const tb = timeAtIndex(b.startAt, b.arriveAt, b.path.length, bi);
          if (Math.abs(ta - tb) > 12000) continue;
          const ct = Math.max(ta, tb);
          if (ct > t || ct < windowStart) continue;
          const key = clashKey(a.id, b.id, k);
          if (world.resolvedClash[key]) continue;
          out.push({ a, b, time: ct, tile: k });
        }
      }
    }
  }
  out.sort((x, y) => x.time - y.time);
  return out;
}

function nearestPlayerCity(world: World, x: number, y: number): City | undefined {
  let best: City | undefined;
  let bestD = Infinity;
  for (const c of Object.values(world.cities)) {
    if (c.npc) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function pickNpcRaidTarget(world: World, origin: City): { x: number; y: number } | undefined {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const empty: { x: number; y: number }[] = [];
  const cities: { x: number; y: number }[] = [];
  for (const [dx, dy] of dirs) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    if (!isPlayerClaim(world, x, y)) continue;
    const c = cityAt(world, x, y);
    if (c && !c.npc) cities.push({ x, y });
    else empty.push({ x, y });
  }
  if (empty.length) return empty.sort((a, b) => a.x - b.x || a.y - b.y)[0];
  if (cities.length) return cities.sort((a, b) => a.x - b.x || a.y - b.y)[0];
  const city = nearestPlayerCity(world, origin.x, origin.y);
  return city ? { x: city.x, y: city.y } : undefined;
}

function incomingNpcCount(world: World, x: number, y: number) {
  return Object.values(world.marches).filter((m) => m.toX === x && m.toY === y && m.owner.startsWith("npc:")).length;
}

function spawnNpcRaids(world: World, from: number, t: number) {
  const players = Object.values(world.cities).filter((c) => !c.npc);
  if (!players.length) return;
  for (const origin of Object.values(world.cities)) {
    if (!origin.npc) continue;
    fillNpcGarrison(world, origin);
    if (Object.values(world.marches).some((m) => m.fromCityId === origin.id)) continue;
    const level = origin.tribeLevel || 1;
    const period = Math.max(90000, 280000 - level * 9000);
    const slot = Math.floor(t / period);
    const start = slot * period;
    if (start <= from) continue;
    const key = `${origin.id}:${slot}`;
    if (world.raidDone[key]) continue;
    world.raidDone[key] = true;
    const target = pickNpcRaidTarget(world, origin);
    if (!target) continue;
    const destCity = cityAt(world, target.x, target.y);
    const dist = Math.hypot(origin.x - target.x, origin.y - target.y);
    if (dist > 18) continue;
    if (destCity && !destCity.npc && start < destCity.foundedAt + 240000) continue;
    if (incomingNpcCount(world, target.x, target.y) >= 2) continue;
    const crew = garrisonPeople(world, origin.id).sort((a, b) => a.id.localeCompare(b.id));
    const ships = garrisonShips(world, origin.id);
    if (crew.length < 2) continue;
    const take = crew.slice(0, Math.max(2, Math.ceil(crew.length * 0.55)));
    const path = planPath(origin.x, origin.y, target.x, target.y, ships.length > 0);
    if (!path.ok) continue;
    if (path.naval && ((origin.buildings.harbor?.level || 0) < 1 || !ships.some((s) => s.role === "transport"))) continue;
    const id = uniqueId(["raid", origin.id, String(slot)]);
    const personIds = take.map((c) => c.id);
    const shipIds = path.naval ? ships.map((s) => s.id) : [];
    for (const cid of [...personIds, ...shipIds]) {
      if (world.cards[cid]) world.cards[cid].marchId = id;
    }
    const speed = slowest([...take, ...ships]);
    const sec = marchSeconds(path.dist, speed, path.naval, origin.buildings.harbor?.level || 0);
    world.marches[id] = {
      id,
      owner: origin.owner,
      fromCityId: origin.id,
      fromX: origin.x,
      fromY: origin.y,
      toX: target.x,
      toY: target.y,
      squadId: "",
      personIds,
      shipIds,
      mission: "plunder",
      startAt: start,
      arriveAt: start + sec * 1000,
      path: path.tiles,
      naval: path.naval,
      entropy: u32(`${world.digest}|${key}`).toString(16),
    };
  }
}

function respawnTribes(world: World, t: number) {
  for (const [id, g] of Object.entries(world.gone)) {
    if (g.respawnAt > t) continue;
    const [_, xs, ys] = id.split(":");
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isFinite(x)) continue;
    if (isPlayerClaim(world, x, y) || (cityAt(world, x, y) && !cityAt(world, x, y)!.npc)) {
      g.respawnAt = t + respawnMs(g.level || 1);
      continue;
    }
    delete world.gone[id];
    makeNpcCity(world, x, y);
  }
}

function seedTribesAroundPlayers(world: World) {
  for (const c of Object.values(world.cities)) {
    if (c.npc) continue;
    ensureNpcsNear(world, c.x, c.y);
    ensureSystemNear(world, c.x, c.y);
  }
}

function tickWorld(world: World, t: number) {
  sweepFallen(world);
  const from = world.simAt || 0;
  respawnTribes(world, t);
  for (const city of Object.values(world.cities)) tickCity(world, city, t);
  if (t > from) spawnNpcRaids(world, from, t);
  const clashes = findClashes(world, t);
  for (const c of clashes) {
    if (!world.marches[c.a.id] || !world.marches[c.b.id]) continue;
    world.resolvedClash[clashKey(c.a.id, c.b.id, c.tile)] = true;
    const fight = fightMarch(world, c.a, c.time, undefined, true, c.b);
    const aLive = [...c.a.personIds, ...c.a.shipIds].filter((id) => world.cards[id]).length;
    const bLive = [...c.b.personIds, ...c.b.shipIds].filter((id) => world.cards[id]).length;
    if (aLive === 0 || fight.report.collapsed === "atk") {
      returnHome(world, [...c.a.personIds, ...c.a.shipIds].filter((id) => world.cards[id]), world.cities[c.a.fromCityId]?.id);
      delete world.marches[c.a.id];
    }
    if (bLive === 0) {
      returnHome(world, [...c.b.personIds, ...c.b.shipIds].filter((id) => world.cards[id]), world.cities[c.b.fromCityId]?.id);
      delete world.marches[c.b.id];
    }
  }
  const arrived = Object.values(world.marches).filter((m) => m.arriveAt <= t);
  arrived.sort((a, b) => a.arriveAt - b.arriveAt || a.id.localeCompare(b.id));
  for (const m of arrived) {
    if (!world.marches[m.id]) continue;
    resolveArrival(world, m, Math.max(t, m.arriveAt));
  }
  world.simAt = t;
}

function skip(world: World, cmd: Command, reason: string) {
  world.skipped.push(`${cmd.label}: ${reason}`);
}

function applyCommand(world: World, cmd: Command, owner: string, t: number, batchKey: string, entropy: string, proofs: Record<string, TxProof> = {}) {
  if (cmd.kind === "found_city") {
    const x = cmd.x!;
    const y = cmd.y!;
    const tera = terrainAt(x, y);
    if (!canFound(tera)) return skip(world, cmd, "地形不可建城");
    if ((world.gone[cityIdAt(x, y)]?.respawnAt || 0) > t) return skip(world, cmd, "废墟尚未散尽");
    const existing = cityAt(world, x, y);
    if (existing?.systemRank) return skip(world, cmd, "系统城不能直接建城，请用占领");
    if (existing?.npc || npcAt(x, y)) return skip(world, cmd, "此处有野蛮人聚落，须出征占领，不能直接建城");
    if (existing) {
      return skip(world, cmd, existing.owner === owner ? "这里已是你的城" : "此地已有城邦");
    }
    const claimed = claimOwner(world, x, y);
    if (claimed && claimed !== owner) return skip(world, cmd, "此地已被他人连通");
    const owned = Object.values(world.cities).filter((c) => c.owner === owner && !c.npc);
    if (owned.length > 0) return skip(world, cmd, "首座城邦已建立，其余请用殖民指令");
    const water = isWater(tera);
    const city: City = {
      id: cityIdAt(x, y),
      owner,
      name: cmd.name || (tera === "sea" ? "海港城" : tera === "mountain" ? "山城" : "新城邦"),
      x,
      y,
      buildings: {
        acropolis: { level: 1, wars: [] },
        oikos: { level: 1, wars: [] },
        agora: { level: 1, wars: [] },
        barracks: { level: 1, wars: [] },
        ...(water ? { harbor: { level: 1, wars: [] }, shipyard: { level: 1, wars: [] } } : {}),
      },
      plots: [],
      foundedAt: t,
      npc: false,
      frontage: frontageAt(x, y),
      buildMult: buildMultAt(x, y),
      wars: [],
      hamlet: "city",
      peakLevel: 1,
    };
    world.cities[city.id] = city;
    seedCityPlots(city, water
      ? ["acropolis", "oikos", "agora", "barracks", "harbor", "shipyard"]
      : ["acropolis", "oikos", "agora", "barracks"]);
    claimTile(world, owner, city.x, city.y);
    (["hoplite", "peltast"] as RoleId[]).forEach((role, i) => {
      const card = mintCard({
        id: uniqueId([batchKey, cmd.id, role, String(i)]),
        role,
        owner,
        cityId: city.id,
        bornAt: t,
        bornTx: entropy,
      });
      world.cards[card.id] = card;
    });
    mintSupply(world, 8, owner, city.id, t, `${entropy}:found`);
    if (water) {
      const ship = mintCard({
        id: uniqueId([batchKey, cmd.id, "transport"]),
        role: "transport",
        owner,
        cityId: city.id,
        bornAt: t,
        bornTx: entropy,
      });
      world.cards[ship.id] = ship;
    }
    return;
  }

  const city = cmd.cityId ? world.cities[cmd.cityId] : cmd.fromCityId ? world.cities[cmd.fromCityId] : undefined;

  if (cmd.kind === "upgrade") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    const bid = cmd.building!;
    const def = BUILDINGS[bid];
    ensureCityPlots(city);
    if (def.needCoast && !isWater(terrainAt(city.x, city.y))) return skip(world, cmd, "港口与船厂要建在海岸或海域城");
    const busyJobs = (city.plots || []).filter((p) => p.job).length;
    const slots = buildSlotsOf(city);
    if (busyJobs >= slots) return skip(world, cmd, `同时在建已满（市政广场允许 ${slots} 座）`);
    const pickedPlot = cmd.plotId ? city.plots.find((p) => p.id === cmd.plotId) : undefined;
    let plot = pickedPlot;
    if (pickedPlot?.building && pickedPlot.building !== bid) return skip(world, cmd, "这块空地已有其他建筑");
    if (pickedPlot && !pickedPlot.building && !canBuildOn(bid, pickedPlot.kind)) {
      return skip(world, cmd, "空地种类不符");
    }
    if (!plot) plot = findPlotFor(city, bid, cmd.plotId);
    if (!plot) return skip(world, cmd, "请点一块相符的空地。同种建筑可建多座，每块空地一座");
    const isNew = !plot.building;
    if (isNew && !findEmptyPlot(city, bid, plot.id)) return skip(world, cmd, "空地不符或已被占用");
    const curLv = isNew ? 0 : workLevel(plot);
    if (plot.job) return skip(world, cmd, "这座建筑正在施工");
    const acro = highestLevel(city, "acropolis") || 1;
    if (bid !== "acropolis" && curLv >= acro) return skip(world, cmd, "需先升级卫城");
    if (curLv >= def.max) return skip(world, cmd, bid === "wall" ? "城墙单座最高 3 级，请另找空地再修一座" : "已达最高等级");
    const next = curLv + 1;
    const cap = cityLevelCap(world, city);
    if (next > cap) {
      return skip(world, cmd, isHamlet(city)
        ? "附属聚落请用「升级为郊区/城区」"
        : `单座等级上限 ${cap}。相连乡村给主城每座建筑加上限，须在主城升级才能用，不会直接加等级`);
    }
    const cost = slaveCostFor(next);
    const need = workersFor(next);
    const pool = idleWorkers(world, city.id, owner);
    const picked = (cmd.workerIds || []).map((id) => world.cards[id]).filter(Boolean);
    const workers = (picked.length >= need ? picked.slice(0, need) : pool.slice(0, need));
    if (workers.length < need) return skip(world, cmd, `建造要占用 ${need} 张空闲人物卡监工`);
    if (workers.some((c) => c.owner !== owner || c.cityId !== city.id || c.marchId || c.jobId || c.listedWinston)) {
      return skip(world, cmd, "监工人选已被占用");
    }
    const paid = consumeMaterials(world, city.id, cost);
    if (isNew) {
      plot.building = bid;
      plot.level = 0;
    }
    const jobId = uniqueId([batchKey, cmd.id, "job"]);
    lockWorkers(world, workers, jobId);
    const agoraCut = Math.min(0.5, (city.buildings.agora?.level || 0) * 0.02);
    const bare = paid ? 1 : BARE_BUILD_MULT;
    const time = scaleTime(def.baseTime, next, (1 - agoraCut) * plotTimeMult(city, bid, plot) * ownerScale(world, owner) * bare) * 1000;
    plot.job = { to: next, finishAt: t + time, workerIds: workers.map((c) => c.id), material: paid ? cost : 0 };
    rebuildBuildings(city);
    return;
  }

  if (cmd.kind === "upgrade_site") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    const kind = hamletOf(city);
    if (kind !== "village" && kind !== "suburb") return skip(world, cmd, "只有乡村或郊区可以升格");
    const step = SITE_UPGRADE[kind];
    const goods = idleSupply(world, city.id).length;
    const bonds = idleSlaves(world, city.id).length;
    if (goods < step.supplies) return skip(world, cmd, `升格需要物资 ${step.supplies}`);
    if (bonds < step.slaves) return skip(world, cmd, `升格需要奴隶 ${step.slaves}`);
    consumeKind(world, city.id, "supply", step.supplies);
    if (step.slaves) consumeKind(world, city.id, "slave", step.slaves);
    city.hamlet = step.to;
    bumpPeak(city);
    return;
  }

  if (cmd.kind === "recruit") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    const home = seatCity(world, city);
    const role = cmd.role!;
    const def = ROLES[role];
    if (role === "slave" || role === "supply") return skip(world, cmd, "奴隶不能招募，物资不能招募");
    if (role === "citizen") return skip(world, cmd, "公民只能由本城奴隶转正");
    if (def.building && (home.buildings[def.building]?.level || 0) < 1) {
      return skip(world, cmd, `需要所属城的${BUILDINGS[def.building].name}（乡村只提高主城可升等级，不另开编制）`);
    }
    if (def.needCoast && !isWater(terrainAt(home.x, home.y)) && !isWater(terrainAt(city.x, city.y))) {
      return skip(world, cmd, "舰只与舰长要在海岸或海域城招募");
    }
    const want = Math.max(1, Math.min(40, Math.floor(cmd.count || 1)));
    let made = 0;
    for (let i = 0; i < want; i += 1) {
      if (def.kind !== "ship" && recruitableCount(world, home.id) >= recruitCapOf(home)) {
        if (!made) return skip(world, cmd, "所属城招募上限已满，请在主城升级对应建筑");
        break;
      }
      const roleCap = roleCapOf(home, role);
      if (def.capPerLevel && roleCountOf(world, home.id, role) >= roleCap) {
        if (!made) return skip(world, cmd, `${def.name} 已满：主城${BUILDINGS[def.building!].name} ${home.buildings[def.building!]?.level || 0} 级上限 ${roleCap}`);
        break;
      }
      const id = uniqueId([batchKey, cmd.id, role, owner, String(i)]);
      if (world.fallen?.[id]) continue;
      const card = mintCard({
        id,
        role,
        owner,
        cityId: city.id,
        homeCityId: home.id,
        bornAt: t,
        bornTx: entropy,
      });
      world.cards[card.id] = card;
      made += 1;
    }
    if (!made) return skip(world, cmd, "没有招到人");
    return;
  }

  if (cmd.kind === "form_squad") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    const personIds = cmd.personIds || [];
    const shipIds = cmd.shipIds || [];
    if (!personIds.length) return skip(world, cmd, "小队至少需要一张人物卡");
    for (const id of [...personIds, ...shipIds]) {
      const card = world.cards[id];
      if (!card || card.owner !== owner || card.cityId !== city.id || card.marchId || card.jobId || card.listedWinston) return skip(world, cmd, "名册不在本城或已被占用");
      if (card.squadId && world.squads[card.squadId]) return skip(world, cmd, "名册已在其他小队");
    }
    const squad: Squad = {
      id: uniqueId([batchKey, cmd.id, "squad"]),
      owner,
      cityId: city.id,
      name: cmd.name || `小队 ${personIds.length} 人`,
      personIds,
      shipIds,
      formedAt: t,
    };
    world.squads[squad.id] = squad;
    for (const id of [...personIds, ...shipIds]) world.cards[id].squadId = squad.id;
    return;
  }

  if (cmd.kind === "recall") {
    const march = world.marches[cmd.marchId || ""];
    if (!march || march.owner !== owner) return skip(world, cmd, "无此行军");
    returnHome(world, [...march.personIds, ...march.shipIds].filter((id) => world.cards[id]), world.cities[march.fromCityId]?.id);
    delete world.marches[march.id];
    return;
  }

  if (cmd.kind === "march") {
    if (!city || city.owner !== owner) return skip(world, cmd, "出发城不属于你");
    let personIds = cmd.personIds || [];
    let shipIds = cmd.shipIds || [];
    if (cmd.squadId && world.squads[cmd.squadId]) {
      const sq = world.squads[cmd.squadId];
      if (sq.owner !== owner) return skip(world, cmd, "小队不属于你");
      personIds = sq.personIds.filter((id) => world.cards[id]);
      shipIds = sq.shipIds.filter((id) => world.cards[id]);
    }
    personIds = personIds.filter((id) => world.cards[id]);
    shipIds = shipIds.filter((id) => world.cards[id]);
    if (!personIds.length) return skip(world, cmd, "未选择人物卡或奴隶卡");
    for (const id of [...personIds, ...shipIds]) {
      const card = world.cards[id];
      if (!card || card.owner !== owner || card.cityId !== city.id || card.marchId || card.jobId || card.listedWinston) {
        return skip(world, cmd, "名册不在本城或已被占用");
      }
      if (card.kind === "supply") return skip(world, cmd, "物资卡不能编入军团");
    }
    const people = byIds(world.cards, personIds);
    const ships = byIds(world.cards, shipIds);
    makeNpcCity(world, cmd.toX!, cmd.toY!, true);
    const path = planPath(city.x, city.y, cmd.toX!, cmd.toY!, ships.length > 0);
    if (!path.ok) return skip(world, cmd, path.reason || "无法通行");
    const blocked = corridorBlocked(world, path.tiles, owner, cmd.toX!, cmd.toY!);
    if (blocked) return skip(world, cmd, blocked);
    const chartFar = chartReachError(world, owner, cmd.toX!, cmd.toY!);
    if (chartFar) return skip(world, cmd, chartFar);
    if (cmd.mission === "colonize" || cmd.mission === "settle") {
      if (!canColonize(terrainAt(cmd.toX!, cmd.toY!))) return skip(world, cmd, "海域不能建城或建村，请选海岸或陆地");
      const who = claimOwner(world, cmd.toX!, cmd.toY!);
      if (who && who !== owner) return skip(world, cmd, "此地已被他人连通，请先侦察抢格");
      const gap = claimsGap(world, owner, path.tiles, cmd.toX!, cmd.toY!);
      if (gap) return skip(world, cmd, gap);
    }
    if (cmd.mission === "colonize") {
      if (isHamlet(city)) return skip(world, cmd, "附属乡村不能开辟独立城邦，请从城邦出发");
      if (cityAt(world, cmd.toX!, cmd.toY!)) return skip(world, cmd, "已有聚落，开辟城邦请另选空地");
    }
    if (cmd.mission === "settle") {
      const err = canFoundVillage(world, owner, city, cmd.toX!, cmd.toY!);
      if (err) return skip(world, cmd, err);
    }
    const destCity = cityAt(world, cmd.toX!, cmd.toY!);
    const war = cmd.mission === "plunder" || cmd.mission === "massacre" || cmd.mission === "destroy" || cmd.mission === "occupy";
    if (war && destCity) {
      if (destCity.owner === owner) return skip(world, cmd, "不能攻击自己的城");
      if (alliesOf(world, owner).has(destCity.owner)) return skip(world, cmd, "不能攻击同公会成员");
    }
    if (cmd.mission === "destroy" && destCity?.systemRank) {
      return skip(world, cmd, "系统城不能毁灭，请改占领、劫掠或屠城");
    }
    if (path.naval) {
      if ((city.buildings.harbor?.level || 0) < 1) return skip(world, cmd, "出海必须有港口");
      if (!ships.some((s) => s.role === "transport")) return skip(world, cmd, "过海必须有运输船");
      const warFleet = cmd.mission !== "scout" && cmd.mission !== "reinforce";
      if (warFleet && !ships.some((s) => s.role === "trireme")) return skip(world, cmd, "作战出海需要三列桨座护航");
      if (warFleet && !people.some((p) => p.role === "trierarch")) return skip(world, cmd, "作战出海需要舰长");
      const cap = berthOf(ships);
      const weight = people.reduce((n, p) => n + p.berth, 0);
      if (weight > cap) return skip(world, cmd, `载重不足：泊位 ${cap} / 名册 ${weight}`);
    }
    if (cmd.mission === "colonize") {
      const persons = people.filter((p) => p.kind === "person");
      if (persons.length < COLONIZE_COST.persons) {
        return skip(world, cmd, `第二座城起需要 ${COLONIZE_COST.persons} 张人物卡随行`);
      }
      if (idleKindCount(world, city.id, "slave") < COLONIZE_COST.slaves) {
        return skip(world, cmd, `殖民需要 ${COLONIZE_COST.slaves} 张奴隶卡，抵达后才消耗`);
      }
      if (idleKindCount(world, city.id, "supply") < COLONIZE_COST.supplies) {
        return skip(world, cmd, `殖民需要 ${COLONIZE_COST.supplies} 张物资卡，抵达后才消耗`);
      }
    }
    if (cmd.mission === "settle") {
      const persons = people.filter((p) => p.kind === "person");
      if (persons.length < SETTLE_COST.persons) {
        return skip(world, cmd, `修建乡村需要 ${SETTLE_COST.persons} 张人物卡随行`);
      }
      if (idleKindCount(world, city.id, "slave") < SETTLE_COST.slaves) {
        return skip(world, cmd, `建村需要 ${SETTLE_COST.slaves} 张奴隶卡，抵达后才消耗`);
      }
      if (idleKindCount(world, city.id, "supply") < SETTLE_COST.supplies) {
        return skip(world, cmd, `建村需要 ${SETTLE_COST.supplies} 张物资卡，抵达后才消耗`);
      }
    }
    if (cmd.mission === "scout" && !destCity && terrainAt(cmd.toX!, cmd.toY!) !== "sea") {
      if (!adjacentClaimed(world, owner, cmd.toX!, cmd.toY!) && !isAllyClaim(world, owner, cmd.toX!, cmd.toY!)) {
        return skip(world, cmd, "侦察抢格必须与己方或公会已连通格子相邻，不能从海上直接夺远离连通的空地");
      }
    }
    const id = cmd.id;
    for (const cid of [...personIds, ...shipIds]) world.cards[cid].marchId = id;
    const speed = slowest([...people, ...ships]);
    const sec = Math.floor(marchSeconds(path.dist, speed, path.naval, city.buildings.harbor?.level || 0) * ownerScale(world, owner));
    world.marches[id] = {
      id,
      owner,
      fromCityId: city.id,
      fromX: city.x,
      fromY: city.y,
      toX: cmd.toX!,
      toY: cmd.toY!,
      squadId: cmd.squadId || "",
      personIds,
      shipIds,
      mission: cmd.mission || "plunder",
      startAt: t,
      arriveAt: t + sec * 1000,
      path: path.tiles,
      naval: path.naval,
      entropy,
    };
    return;
  }

  if (cmd.kind === "buy_slave") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    if (idleSupply(world, city.id).length < SUPPLY_PER_SLAVE) return skip(world, cmd, `买奴隶需要 ${SUPPLY_PER_SLAVE} 张本城物资卡`);
    consumeMaterials(world, city.id, SUPPLY_PER_SLAVE);
    mintSlaves(world, 1, owner, city.id, t, `${entropy}:${cmd.id}:buy`);
    return;
  }

  if (cmd.kind === "enfranchise") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    const home = seatCity(world, city);
    const slave = world.cards[cmd.cardId || ""];
    if (!slave || slave.kind !== "slave" || slave.owner !== owner || slave.cityId !== city.id || slave.marchId || slave.jobId) {
      return skip(world, cmd, "本城没有这张空闲奴隶卡");
    }
    if (recruitableCount(world, home.id) >= recruitCapOf(home)) return skip(world, cmd, "所属城招募上限已满");
    if (roleCountOf(world, home.id, "citizen") >= roleCapOf(home, "citizen")) {
      return skip(world, cmd, `公民已满：主城民居 ${home.buildings.oikos?.level || 0} 级上限 ${roleCapOf(home, "citizen")}`);
    }
    slave.kind = "person";
    slave.role = "citizen";
    slave.homeCityId = home.id;
    slave.name = slave.name.replace(/^奴隶·/, "公民·");
    return;
  }

  if (cmd.kind === "list_card") {
    const card = world.cards[cmd.cardId || ""];
    if (card && world.fallen?.[card.id]) return skip(world, cmd, "此卡已阵亡");
    if (!card || card.owner !== owner || card.kind !== "person") return skip(world, cmd, "只能上架自己的人物卡");
    if (card.marchId || card.jobId) return skip(world, cmd, "占用中的卡不能上架");
    if (card.listedWinston) return skip(world, cmd, "已在货架上");
    const winston = Math.max(1, Math.floor(cmd.priceWinston || 0));
    const listingId = uniqueId([batchKey, cmd.id, "list"]);
    card.listedWinston = winston;
    world.listings[listingId] = { id: listingId, cardId: card.id, seller: owner, winston, listedAt: t };
    return;
  }

  if (cmd.kind === "delist_card") {
    const listing = world.listings[cmd.listingId || ""];
    if (!listing || listing.seller !== owner) return skip(world, cmd, "没有这个货架");
    if (world.cards[listing.cardId]) world.cards[listing.cardId].listedWinston = undefined;
    delete world.listings[listing.id];
    return;
  }

  if (cmd.kind === "buy_card") {
    const feeId = cmd.feeTx || cmd.burnTx || "";
    const reason = settleSale(world, cmd.listingId || "", owner, cmd.cityId || city?.id || "", proofs[cmd.payTx || ""], proofs[feeId], t);
    if (reason) return skip(world, cmd, reason);
    return;
  }

  if (cmd.kind === "create_guild") {
    const err = createGuild(world, owner, cmd.name || "无名公会", t, uniqueId([batchKey, cmd.id, "guild"]));
    if (err) return skip(world, cmd, err);
    return;
  }
  if (cmd.kind === "join_guild") {
    const err = joinGuild(world, owner, cmd.guildId || "", t);
    if (err) return skip(world, cmd, err);
    return;
  }
  if (cmd.kind === "leave_guild") {
    const err = leaveGuild(world, owner, t);
    if (err) return skip(world, cmd, err);
    return;
  }
  if (cmd.kind === "kick_guild") {
    const err = kickGuild(world, owner, cmd.memberId || "", t);
    if (err) return skip(world, cmd, err);
    return;
  }
  if (cmd.kind === "invite_guild") {
    const err = inviteGuild(world, owner, cmd.memberId || "");
    if (err) return skip(world, cmd, err);
    return;
  }

  if (cmd.kind === "rename_city") {
    if (!city || city.owner !== owner) return skip(world, cmd, "城邦不属于你");
    if (city.npc) return skip(world, cmd, "不能给敌对聚落改名");
    const name = (cmd.name || "").replace(/\s+/g, " ").trim().slice(0, 16);
    if (name.length < 1) return skip(world, cmd, "名字不能为空");
    city.name = name;
  }
}

function settleSale(
  world: World,
  listingId: string,
  buyer: string,
  cityId: string,
  pay: TxProof | undefined,
  fee: TxProof | undefined,
  _t: number,
): string | null {
  const listing = world.listings[listingId];
  if (!listing) return "货架已撤";
  if (listing.seller === buyer) return "不能买自己的卡";
  const city = world.cities[cityId];
  if (!city || city.owner !== buyer) return "要有一座自己的城接收";
  const need = splitWinston(listing.winston);
  if (!pay || pay.kind !== "sale") return "成交付款无法在链上核对";
  if (!fee || fee.kind !== "fee") return "成交手续费无法在链上核对";
  if (pay.from !== buyer || fee.from !== buyer) return "付款人必须是买家";
  if (pay.target !== listing.seller) return "九成必须打给卖家";
  if (fee.target !== AR_FEE_ADDR) return "一成必须打入手续费地址";
  if ((pay.listingId && pay.listingId !== listing.id) || (fee.listingId && fee.listingId !== listing.id)) {
    return "付款标签对不上这个货架";
  }
  if (pay.winston < need.pay || fee.winston < need.burn) return "成交金额不足";
  if (world.spentPays[pay.id] || world.spentPays[fee.id]) return "这笔付款已经用过";
  const card = world.cards[listing.cardId];
  if (!card || card.kind !== "person") return "此卡已不在";
  world.spentPays[pay.id] = true;
  world.spentPays[fee.id] = true;
  card.owner = buyer;
  card.cityId = city.id;
  card.homeCityId = city.id;
  card.listedWinston = undefined;
  card.marchId = undefined;
  card.jobId = undefined;
  delete world.listings[listing.id];
  return null;
}

function afterCheckpoint(time: number, key: string, checkpoint?: WorldCheckpoint | null) {
  if (!checkpoint) return true;
  if (time > checkpoint.lastTime) return true;
  if (time < checkpoint.lastTime) return false;
  return key > checkpoint.lastKey;
}

function sentEvents(batches: TrackedBatch[], pairs: MarketPair[], checkpoint?: WorldCheckpoint | null) {
  const batchEv = batches
    .filter((b) => b.status === "sent" || b.status === "queued" || b.status === "queued_uploaded" || (b.queryable && b.txId))
    .map((b) => ({ b, time: b.chainTime || b.clientTime }))
    .filter(({ b, time }) => time && afterCheckpoint(time, b.key, checkpoint))
    .map(({ b, time }) => ({
      kind: "batch" as const,
      owner: b.signer || b.owner,
      time,
      commands: b.commands,
      key: b.key,
      txId: b.txId || b.key,
      proofs: b.proofs || {},
    }));
  const saleEv = pairs
    .filter((p) => afterCheckpoint(p.time, p.key, checkpoint))
    .map((p) => ({
      kind: "sale" as const,
      owner: p.buyer,
      time: p.time,
      commands: [] as Command[],
      key: p.key,
      txId: p.pay.id,
      proofs: { [p.pay.id]: p.pay, [p.fee.id]: p.fee },
      pair: p,
    }));
  return [...batchEv, ...saleEv].sort((a, b) => a.time - b.time || (a.kind === "sale" ? 0 : 1) - (b.kind === "sale" ? 0 : 1) || a.key.localeCompare(b.key));
}

/** Fold confirmed batches once. Do not call every animation frame. */
export function foldHistory(batches: TrackedBatch[], checkpoint?: WorldCheckpoint | null, pairs: MarketPair[] = []): World {
  const world = checkpoint ? cloneWorld(checkpoint.world) : emptyWorld();
  if (!world.raidDone) world.raidDone = {};
  if (!world.gone) world.gone = {};
  if (!world.listings) world.listings = {};
  if (!world.spentPays) world.spentPays = {};
  ensureGuildState(world);
  for (const [k, v] of Object.entries(world.gone as Record<string, unknown>)) {
    if (!v || typeof v !== "object") {
      world.gone[k] = { at: 0, respawnAt: Number.MAX_SAFE_INTEGER, level: 1 };
    }
  }
  if (typeof world.simAt !== "number") world.simAt = 0;
  const events = sentEvents(batches, pairs, checkpoint);
  let acc = world.digest || "0";
  for (const ev of events) {
    const entropy = u32(`${acc}|${ev.txId}|${ev.time}|${ev.key}`).toString(16);
    tickWorld(world, ev.time);
    if (ev.kind === "sale" && "pair" in ev && ev.pair) {
      const p = ev.pair;
      settleSale(world, p.listingId, p.buyer, p.cityId, p.pay, p.fee, ev.time);
    }
    for (const cmd of ev.commands) applyCommand(world, cmd, ev.owner, ev.time, ev.key, entropy, ev.proofs);
    acc = `${acc}:${entropy}`;
  }
  const last = events.at(-1)?.time || checkpoint?.lastTime || 0;
  if (last) tickWorld(world, last);
  world.digest = u32(acc).toString(16);
  return world;
}

/** Same 2-minute bucket on every client so wall-clock raids do not fork. */
export function syncTime(now: number, simAt: number) {
  return Math.max(simAt || 0, Math.floor(now / 120000) * 120000);
}

/** Project folded history to wall-clock / camera. One tick, no second replay. */
export function projectWorld(folded: World, now: number, viewX = 0, viewY = 0): World {
  const world = cloneWorld(folded);
  ensureNpcsNear(world, viewX, viewY);
  ensureSystemNear(world, viewX, viewY);
  seedTribesAroundPlayers(world);
  tickWorld(world, syncTime(now, folded.simAt || 0));
  sweepFallen(world);
  return world;
}

export function rebuildWorld(
  batches: TrackedBatch[],
  now: number,
  viewX = 0,
  viewY = 0,
  checkpoint?: WorldCheckpoint | null,
): World {
  return projectWorld(foldHistory(batches, checkpoint), now, viewX, viewY);
}

export function playerCities(world: World, owner: string): City[] {
  if (!owner) return [];
  const mine = Object.values(world.cities).filter((c) => c.owner === owner && !c.npc);
  if (mine.length) return mine;
  const fromCards = new Set(
    Object.values(world.cards).filter((c) => c.owner === owner && c.cityId).map((c) => c.cityId),
  );
  const owned = Object.values(world.cities).filter((c) => c.owner === owner || fromCards.has(c.id));
  return owned;
}

export { buildSlotsOf, citizensOf, homeOf, recruitCapOf, roleCapOf, roleCountOf, worksOf, garrisonPeople, garrisonShips, MISSION_NAME };
export { seatCity } from "./hamlets";
export { idleSupply, idleSlaves, idleWorkers, corridorBlocked };
export { claimsGap, chartReachError, isClaimed, adjacentClaimed, alliesOf } from "./realm";
