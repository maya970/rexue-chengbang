import type { Card, RoleId } from "../types";
import { ROLES } from "./catalog";
import { pick, u32 } from "./hash";
import { EPITHETS, GIVEN, SHIP_NAMES } from "./names";

export function mintCard(input: {
  id: string;
  role: RoleId;
  owner: string;
  cityId: string;
  bornAt: number;
  bornTx: string;
}): Card {
  const def = ROLES[input.role];
  const salt = `${input.id}|${input.role}|${input.owner}`;
  const name =
    def.kind === "ship"
      ? `${def.name}「${pick(SHIP_NAMES, salt)}」`
      : def.kind === "supply"
        ? `物资·${pick(GIVEN, salt).slice(0, 1)}`
        : def.kind === "slave"
          ? `奴隶·${pick(GIVEN, salt)}`
          : `${pick(GIVEN, salt)}·${pick(EPITHETS, salt + "e")}`;
  return {
    id: input.id,
    kind: def.kind,
    role: input.role,
    name,
    owner: input.owner,
    cityId: input.cityId,
    homeCityId: input.cityId,
    bornAt: input.bornAt,
    bornTx: input.bornTx,
    campaigns: [],
    berth: def.berth,
    speed: def.speed,
  };
}

export function byIds(all: Record<string, Card>, ids: string[]): Card[] {
  return ids.map((id) => all[id]).filter(Boolean);
}

export function present(cards: Card[]): Card[] {
  return cards.filter(Boolean);
}

export function berthOf(ships: Card[]): number {
  return ships.filter((c) => c.kind === "ship").reduce((n, c) => n + c.berth, 0);
}

export function slowest(cards: Card[]): number {
  if (!cards.length) return 8;
  return Math.min(...cards.map((c) => c.speed));
}

export function cardLine(cards: Card[]): string {
  if (!cards.length) return "无";
  return cards.map((c) => `${c.name}（${ROLES[c.role].name}·${c.campaigns.length}战）`).join("、");
}

export function uniqueId(parts: string[]): string {
  return `c${u32(parts.join("|")).toString(16)}`;
}

export function avgCampaigns(cards: Card[]): number {
  if (!cards.length) return 0;
  return cards.reduce((s, c) => s + c.campaigns.length, 0) / cards.length;
}
