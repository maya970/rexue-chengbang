import type { BattleReport } from "../types";

const PREFIX = "rexue-chengbang-inbox:";
const CAP = 400;

function keyOf(address: string) {
  return PREFIX + (address || "anon");
}

export function loadInbox(address: string): BattleReport[] {
  if (!address) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(keyOf(address)) || "[]") as BattleReport[];
    if (!Array.isArray(raw)) return [];
    return raw.filter((r) => r && typeof r.id === "string").map((r) => ({
      ...r,
      rounds: Array.isArray(r.rounds) ? r.rounds : [],
      deadNames: Array.isArray(r.deadNames) ? r.deadNames : [],
    }));
  } catch {
    return [];
  }
}

export function mergeInbox(address: string, incoming: BattleReport[]): BattleReport[] {
  if (!address) return incoming;
  const byId = new Map<string, BattleReport>();
  for (const r of loadInbox(address)) byId.set(r.id, r);
  for (const r of incoming) {
    if (!r?.id) continue;
    const prev = byId.get(r.id);
    byId.set(r.id, prev && (prev.rounds?.length || 0) > (r.rounds?.length || 0) ? { ...r, ...prev, rounds: prev.rounds } : r);
  }
  const next = [...byId.values()].sort((a, b) => b.time - a.time || a.id.localeCompare(b.id)).slice(0, CAP);
  try {
    localStorage.setItem(keyOf(address), JSON.stringify(next));
  } catch { /* quota */ }
  return next;
}
