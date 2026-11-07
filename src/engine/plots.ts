import { BUILDING_PLOTS, BUILDINGS, CITY_H, CITY_W, PLOT_TIME } from "./catalog";
import { hashXY, terrainAt } from "./map";
import type { BuildingId, City, CityPlot, PlotKind, Terrain } from "../types";

const MIX: Record<Terrain, Record<PlotKind, number>> = {
  plain: { plaza: 2, housing: 6, camp: 3, grove: 1, quarry: 1, harbor: 0, yard: 2 },
  forest: { plaza: 1, housing: 4, camp: 2, grove: 5, quarry: 1, harbor: 0, yard: 1 },
  coast: { plaza: 2, housing: 4, camp: 2, grove: 0, quarry: 1, harbor: 4, yard: 1 },
  mountain: { plaza: 1, housing: 3, camp: 2, grove: 1, quarry: 5, harbor: 0, yard: 1 },
  sea: { plaza: 1, housing: 2, camp: 1, grove: 0, quarry: 0, harbor: 6, yard: 1 },
};

export function isCityRoad(lx: number, ly: number) {
  return lx === 5 || ly === 4;
}

function shuffle<T>(list: T[], x: number, y: number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = hashXY(x, y, 700 + i) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function generateCityPlots(wx: number, wy: number): CityPlot[] {
  const mix = MIX[terrainAt(wx, wy)];
  const kinds: PlotKind[] = [];
  (Object.keys(mix) as PlotKind[]).forEach((k) => {
    for (let n = 0; n < mix[k]; n += 1) kinds.push(k);
  });
  const cells: { lx: number; ly: number }[] = [];
  for (let ly = 0; ly < CITY_H; ly += 1) {
    for (let lx = 0; lx < CITY_W; lx += 1) {
      if (isCityRoad(lx, ly)) continue;
      cells.push({ lx, ly });
    }
  }
  const placed = shuffle(cells, wx, wy);
  const want = shuffle(kinds, wx, wy + 9);
  const plots: CityPlot[] = [];
  for (let i = 0; i < want.length && i < placed.length; i += 1) {
    const cell = placed[i];
    const n = hashXY(wx + cell.lx, wy + cell.ly, 411) / 4294967296;
    plots.push({
      id: `plot:${cell.lx}:${cell.ly}`,
      lx: cell.lx,
      ly: cell.ly,
      kind: want[i],
      timeMult: 0.72 + n * 0.7,
    });
  }
  return plots;
}

export function canBuildOn(bid: BuildingId, kind: PlotKind) {
  return BUILDING_PLOTS[bid].includes(kind);
}

export function findPlotFor(city: City, bid: BuildingId, plotId?: string): CityPlot | undefined {
  const existing = city.plots.find((p) => p.building === bid);
  if (existing) return existing;
  if (plotId) return city.plots.find((p) => p.id === plotId && !p.building && canBuildOn(bid, p.kind));
  return city.plots.find((p) => !p.building && canBuildOn(bid, p.kind));
}

export function occupyPlot(city: City, bid: BuildingId, plotId?: string): CityPlot | null {
  const plot = findPlotFor(city, bid, plotId);
  if (!plot) return null;
  plot.building = bid;
  return plot;
}

export function plotOfBuilding(city: City, bid: BuildingId) {
  return city.plots.find((p) => p.building === bid);
}

export function plotTimeMult(city: City, bid: BuildingId, plot?: CityPlot) {
  const p = plot || plotOfBuilding(city, bid);
  if (!p) return city.buildMult[bid] || 1;
  return (city.buildMult[bid] || 1) * PLOT_TIME[p.kind] * p.timeMult;
}

export function builtPlotCount(city: City) {
  return city.plots.filter((p) => p.building).length;
}

export function ensureCityPlots(city: City) {
  if (!city.plots?.length) city.plots = generateCityPlots(city.x, city.y);
  for (const bid of Object.keys(BUILDINGS) as BuildingId[]) {
    const b = city.buildings[bid];
    if (!b || (b.level < 1 && !b.job)) continue;
    if (city.plots.some((p) => p.building === bid)) continue;
    occupyPlot(city, bid);
  }
}

export function seedCityPlots(city: City, starter: BuildingId[]) {
  city.plots = generateCityPlots(city.x, city.y);
  for (const bid of starter) occupyPlot(city, bid);
}
