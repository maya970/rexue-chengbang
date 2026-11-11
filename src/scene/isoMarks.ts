import type { BuildingId, City, HamletKind } from "../types";
import { displayLevel, hamletOf } from "../engine/hamlets";
import { drawIsoHouse, TH } from "./iso";
import { buildingSprite, plantSprite, settleSprite } from "./artSprites";

export const HOUSE_PAL: Record<BuildingId, { top: string; left: string; right: string }> = {
  acropolis: { top: "#c83828", left: "#6a1818", right: "#8a2828" },
  agora: { top: "#e8d090", left: "#7a6840", right: "#a08850" },
  oikos: { top: "#c06048", left: "#6a3020", right: "#8a4430" },
  barracks: { top: "#8a8070", left: "#4a4438", right: "#6a6458" },
  stables: { top: "#a07848", left: "#5a4028", right: "#7a5838" },
  range: { top: "#5a8848", left: "#2a4a24", right: "#3e6a34" },
  wall: { top: "#9a9488", left: "#4a4840", right: "#6a6860" },
  temple: { top: "#f0e8d0", left: "#8a7a58", right: "#b0a070" },
  shipyard: { top: "#6a88a0", left: "#304050", right: "#486070" },
  harbor: { top: "#4a90b8", left: "#204858", right: "#306878" },
};

const CITY_PAL = { top: "#d4c4a0", left: "#6a5040", right: "#8a6c50" };
const VILLAGE_PAL = { top: "#c8a060", left: "#5a4028", right: "#7a5838" };
const SUBURB_PAL = { top: "#d8b878", left: "#6a4828", right: "#8a6438" };
const URBAN_PAL = { top: "#e8d090", left: "#7a5840", right: "#9a7450" };
const CASTLE_PAL = { top: "#c83828", left: "#5a1818", right: "#8a2828" };

export function hamletPal(kind: HamletKind) {
  if (kind === "village") return VILLAGE_PAL;
  if (kind === "suburb") return SUBURB_PAL;
  if (kind === "urban") return URBAN_PAL;
  return CASTLE_PAL;
}

function markKind(city: City): HamletKind | "barbarian" | "pirate" | "ruin" | "system" {
  if (city.systemRank) return "system";
  if (city.npc) {
    const who = city.owner || "";
    if (who.includes("pirates")) return "pirate";
    if (who.includes("polis")) return "ruin";
    return "barbarian";
  }
  return hamletOf(city);
}

export function drawCityMark(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, city: City, yaw = 0) {
  const kind = markKind(city);
  const spr = settleSprite(kind);
  if (spr) {
    const width = kind === "pirate" ? 0.98 : 1;
    plantSprite(ctx, spr, x, y, scale, { width, flip: (yaw & 1) === 1, foot: 1 });
    return;
  }
  if (kind === "barbarian") {
    drawBarbarianMark(ctx, x, y + TH * scale * 0.5, scale);
    return;
  }
  const stories = kind === "city" ? 1.35 : kind === "urban" ? 1.15 : kind === "suburb" ? 0.95 : 0.75;
  drawIsoHouse(ctx, x, y + TH * scale * 0.15, scale * 0.72, hamletPal(hamletOf(city)), stories);
}

export function drawBuildingMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  id: BuildingId,
  level = 1,
  yaw = 0,
) {
  const spr = buildingSprite(id);
  if (spr) {
    const width = 0.92 + Math.min(0.28, level * 0.04);
    plantSprite(ctx, spr, x, y, scale, { width, flip: (yaw & 1) === 1, foot: 1 });
    return;
  }
  const pal = HOUSE_PAL[id] || CITY_PAL;
  const stories = 0.85 + Math.min(1.4, level * 0.18);
  drawIsoHouse(ctx, x, y + TH * scale * 0.12, scale, pal, stories);
}

export function drawBarbarianMark(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  const spr = settleSprite("barbarian");
  if (spr) {
    plantSprite(ctx, spr, x, y, scale, { width: 1, foot: 1 });
    return;
  }
  const s = scale;
  drawIsoHouse(ctx, x, y, s * 0.55, { top: "#8a6a48", left: "#4a3020", right: "#6a4830" }, 1.05);
  ctx.save();
  ctx.fillStyle = "#e0b090";
  ctx.fillRect(x - 3.2 * s, y - 2.2 * s, 6.4 * s, 5.2 * s);
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(x - 3.2 * s, y - 3.4 * s, 6.4 * s, 1.6 * s);
  ctx.fillStyle = "#6a4424";
  ctx.fillRect(x + 4.2 * s, y - 11 * s, 2.2 * s, 14 * s);
  ctx.fillStyle = "#c8a070";
  ctx.beginPath();
  ctx.ellipse(x + 5.4 * s, y - 12.2 * s, 4.2 * s, 3.1 * s, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function markLevel(city: City) {
  return { lv: displayLevel(city), peak: city.peakLevel || displayLevel(city) };
}
