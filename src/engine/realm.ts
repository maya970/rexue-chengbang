import { canFound, cityIdAt, hashXY, isWater, terrainAt } from "./map";
import { seedCityPlots } from "./plots";
import { buildMultAt, frontageAt } from "./site";
import type { Guild, SystemRank, World } from "../types";

export const GUILD_BAN_MS = 30 * 24 * 60 * 60 * 1000;

export function tileKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function alliesOf(world: World, owner: string): Set<string> {
  const set = new Set<string>([owner]);
  const gid = world.memberOf?.[owner];
  const g = gid ? world.guilds?.[gid] : undefined;
  if (g) for (const m of g.members) set.add(m);
  return set;
}

export function isClaimed(world: World, owner: string, x: number, y: number) {
  const who = world.claims?.[tileKey(x, y)];
  if (!who) return false;
  return alliesOf(world, owner).has(who);
}

export function claimTile(world: World, owner: string, x: number, y: number) {
  if (!world.claims) world.claims = {};
  world.claims[tileKey(x, y)] = owner;
}

export function adjacentClaimed(world: World, owner: string, x: number, y: number) {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (isClaimed(world, owner, x + dx, y + dy)) return true;
  }
  return false;
}

export function claimsGap(world: World, owner: string, tiles: { x: number; y: number }[], destX: number, destY: number): string | null {
  for (let i = 0; i < tiles.length; i += 1) {
    const p = tiles[i];
    if (p.x === destX && p.y === destY) {
      if (!adjacentClaimed(world, owner, p.x, p.y) && !isClaimed(world, owner, p.x, p.y)) {
        return `第二座城必须与已打下来的格子连通 (${p.x},${p.y})`;
      }
      continue;
    }
    if (!isClaimed(world, owner, p.x, p.y)) return `须先打通连通格 (${p.x},${p.y})`;
  }
  return null;
}

const RANKS: { scale: number; rank: SystemRank; name: string; level: number }[] = [
  { scale: 100, rank: "town", name: "系统小镇", level: 6 },
  { scale: 1000, rank: "city", name: "系统城市", level: 12 },
  { scale: 10000, rank: "metro", name: "系统都市", level: 18 },
];

export function systemAnchor(gx: number, gy: number, scale: number): { x: number; y: number } | null {
  const cx = gx * scale + Math.floor(scale / 2);
  const cy = gy * scale + Math.floor(scale / 2);
  const jitter = hashXY(gx, gy, scale) % Math.max(3, Math.floor(scale / 8));
  const ox = cx + (hashXY(gx, gy, 3) % 2 ? jitter : -jitter);
  const oy = cy + (hashXY(gx, gy, 5) % 2 ? jitter : -jitter);
  const lim = Math.min(48, Math.floor(scale / 2) - 1);
  for (let r = 0; r <= lim; r += 1) {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = ox + dx;
        const y = oy + dy;
        if (x < gx * scale || y < gy * scale || x >= (gx + 1) * scale || y >= (gy + 1) * scale) continue;
        if (canFound(terrainAt(x, y))) return { x, y };
      }
    }
  }
  return null;
}

export function systemMeta(rank: SystemRank) {
  return RANKS.find((r) => r.rank === rank)!;
}

export function ensureSystemNear(world: World, x: number, y: number) {
  for (const row of RANKS) {
    const gx0 = Math.floor(x / row.scale);
    const gy0 = Math.floor(y / row.scale);
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const gx = gx0 + dx;
        const gy = gy0 + dy;
        const pos = systemAnchor(gx, gy, row.scale);
        if (!pos) continue;
        const id = cityIdAt(pos.x, pos.y);
        const existing = world.cities[id];
        if (existing) {
          if (!existing.systemRank) existing.systemRank = row.rank;
          continue;
        }
        const lv = row.level;
        world.cities[id] = {
          id,
          owner: `npc:system:${row.rank}`,
          name: `${row.name}·${gx},${gy}`,
          x: pos.x,
          y: pos.y,
          buildings: {
            acropolis: { level: Math.min(16, Math.ceil(lv / 2)), wars: [] },
            oikos: { level: Math.min(12, Math.ceil(lv / 3)), wars: [] },
            wall: { level: Math.min(10, Math.ceil(lv / 3)), wars: [] },
            barracks: { level: Math.min(8, Math.ceil(lv / 4)), wars: [] },
            agora: { level: Math.min(6, Math.ceil(lv / 5)), wars: [] },
            harbor: isWater(terrainAt(pos.x, pos.y)) ? { level: Math.min(6, Math.ceil(lv / 5)), wars: [] } : undefined,
          },
          plots: [],
          foundedAt: 0,
          npc: true,
          frontage: frontageAt(pos.x, pos.y),
          buildMult: buildMultAt(pos.x, pos.y),
          wars: [],
          tribeLevel: lv,
          systemRank: row.rank,
        };
        seedCityPlots(
          world.cities[id],
          (Object.keys(world.cities[id].buildings) as import("../types").BuildingId[]).filter((bid) => (world.cities[id].buildings[bid]?.level || 0) > 0),
        );
      }
    }
  }
}

export function ensureGuildState(world: World) {
  if (!world.claims) world.claims = {};
  if (!world.guilds) world.guilds = {};
  if (!world.memberOf) world.memberOf = {};
  if (!world.guildBanUntil) world.guildBanUntil = {};
}

export function createGuild(world: World, owner: string, name: string, t: number, id: string): string | null {
  ensureGuildState(world);
  if (world.memberOf[owner]) return "已在公会中";
  const g: Guild = { id, name: name.slice(0, 16) || "无名公会", leader: owner, members: [owner], createdAt: t };
  world.guilds[id] = g;
  world.memberOf[owner] = id;
  return null;
}

export function joinGuild(world: World, owner: string, guildId: string, t: number): string | null {
  ensureGuildState(world);
  if (world.memberOf[owner]) return "已在公会中";
  if ((world.guildBanUntil[owner] || 0) > t) return "退出公会后一个月内不能加入其他公会";
  const g = world.guilds[guildId];
  if (!g) return "没有这个公会";
  if (!g.members.includes(owner)) g.members.push(owner);
  world.memberOf[owner] = guildId;
  return null;
}

export function leaveGuild(world: World, owner: string, t: number): string | null {
  ensureGuildState(world);
  const gid = world.memberOf[owner];
  const g = gid ? world.guilds[gid] : undefined;
  if (!g) return "不在公会中";
  g.members = g.members.filter((m) => m !== owner);
  delete world.memberOf[owner];
  world.guildBanUntil[owner] = t + GUILD_BAN_MS;
  if (g.leader === owner) g.leader = g.members[0] || "";
  if (!g.members.length) delete world.guilds[g.id];
  return null;
}
