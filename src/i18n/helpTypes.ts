export const HELP_IDS = [
  "about",
  "start",
  "found",
  "colonize",
  "march",
  "reports",
  "market",
  "guild",
  "atlas",
  "roster",
  "towns",
] as const;

export type HelpId = (typeof HELP_IDS)[number];
export type HelpSection = { id: HelpId; title: string; body: string };
export type HelpPack = Record<HelpId, [string, string]>;

export function secs(pack: HelpPack): HelpSection[] {
  return HELP_IDS.map((id) => ({ id, title: pack[id][0], body: pack[id][1] }));
}
