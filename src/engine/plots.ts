import { BUILDING_PLOTS, BUILDINGS, CITY_H, CITY_W, PLOT_ELEV, PLOT_TIME } from "./catalog";
import { hashXY, terrainAt } from "./map";
import { slopeConnect } from "./height";
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

function kindForHeight(h: number, t: Terrain, n: number): PlotKind {
  if (t === "coast" && h <= 0) return "harbor";
  if (h <= 1) return n % 3 === 0 ? "yard" : "housing";
  if (h === 2) return n % 2 === 0 ? "plaza" : "camp";
  if (h === 3) return "grove";
  return "quarry";
}

export function makeCityHeights(wx: number, wy: number): number[][] {
  const t = terrainAt(wx, wy);
  const grid: number[][] = [];
  for (let ly = 0; ly < CITY_H; ly += 1) {
    grid[ly] = [];
    for (let lx = 0; lx < CITY_W; lx += 1) {
      const slope = (lx / Math.max(1, CITY_W - 1) + ly / Math.max(1, CITY_H - 1)) / 2;
      const n = hashXY(wx + lx, wy + ly, 90) / 4294967296;
      let h = 1;
      if (t === "coast") h = Math.round((1 - ly / Math.max(1, CITY_H - 1)) * 3);
      else if (t === "mountain") h = Math.round(1 + slope * 4 + n * 0.4);
      else if (t === "forest") h = Math.round(1 + (1 - slope) * 2 + n * 0.5);
      else if (t === "sea") h = Math.round((1 - ly / Math.max(1, CITY_H - 1)) * 2);
      else h = Math.round(1 + Math.abs(slope - 0.45) * 2 + n * 0.3);
      grid[ly][lx] = Math.max(0, Math.min(4, h));
    }
  }
  slopeConnect(grid, (x, y) => grid[y][x] <= 0);
  return grid;
}

export function cityHeightGrid(city: City): number[][] {
  const grid: number[][] = [];
  for (let ly = 0; ly < CITY_H; ly += 1) {
    grid[ly] = [];
    for (let lx = 0; lx < CITY_W; lx += 1) grid[ly][lx] = 1;
  }
  if (city.plots?.length) {
    for (const p of city.plots) {
      if (p.ly >= 0 && p.ly < CITY_H && p.lx >= 0 && p.lx < CITY_W) {
        grid[p.ly][p.lx] = p.elev ?? PLOT_ELEV[p.kind];
      }
    }
    for (let ly = 0; ly < CITY_H; ly += 1) {
      for (let lx = 0; lx < CITY_W; lx += 1) {
        if (!isCityRoad(lx, ly)) continue;
        const nbs: number[] = [];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = lx + dx;
          const ny = ly + dy;
          if (nx < 0 || ny < 0 || nx >= CITY_W || ny >= CITY_H) continue;
          if (!isCityRoad(nx, ny)) nbs.push(grid[ny][nx]);
        }
        grid[ly][lx] = nbs.length ? Math.round(nbs.reduce((a, b) => a + b, 0) / nbs.length) : 1;
      }
    }
    for (const p of city.plots) {
      if (p.kind === "harbor" && p.ly >= 0 && p.ly < CITY_H && p.lx >= 0 && p.lx < CITY_W) grid[p.ly][p.lx] = 0;
    }
    slopeConnect(grid, (x, y) => grid[y][x] <= 0);
    return grid;
  }
  return makeCityHeights(city.x, city.y);
}

export function generateCityPlots(wx: number, wy: number): CityPlot[] {
  const t = terrainAt(wx, wy);
  const heights = makeCityHeights(wx, wy);
  const mix = MIX[t];
  const want: PlotKind[] = [];
  (Object.keys(mix) as PlotKind[]).forEach((k) => {
    for (let n = 0; n < mix[k]; n += 1) want.push(k);
  });
  const cells: { lx: number; ly: number; h: number }[] = [];
  for (let ly = 0; ly < CITY_H; ly += 1) {
    for (let lx = 0; lx < CITY_W; lx += 1) {
      if (isCityRoad(lx, ly)) continue;
      cells.push({ lx, ly, h: heights[ly][lx] });
    }
  }
  cells.sort((a, b) => a.h - b.h || a.ly - b.ly || a.lx - b.lx);
  const plots: CityPlot[] = [];
  const used = new Set<string>();
  const take = (kind: PlotKind) => {
    const target = PLOT_ELEV[kind];
    const slot = cells.find((c) => !used.has(`${c.lx}:${c.ly}`) && Math.abs(c.h - target) <= 1)
      || cells.find((c) => !used.has(`${c.lx}:${c.ly}`));
    if (!slot) return;
    used.add(`${slot.lx}:${slot.ly}`);
    const n = hashXY(wx + slot.lx, wy + slot.ly, 411) / 4294967296;
    plots.push({
      id: `plot:${slot.lx}:${slot.ly}`,
      lx: slot.lx,
      ly: slot.ly,
      kind,
      timeMult: 0.72 + n * 0.7,
      elev: slot.h,
    });
  };
  for (const kind of want) take(kind);
  for (const cell of cells) {
    if (used.has(`${cell.lx}:${cell.ly}`)) continue;
    const n = hashXY(wx + cell.lx, wy + cell.ly, 77);
    plots.push({
      id: `plot:${cell.lx}:${cell.ly}`,
      lx: cell.lx,
      ly: cell.ly,
      kind: kindForHeight(cell.h, t, n),
      timeMult: 0.72 + (n / 4294967296) * 0.7,
      elev: cell.h,
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
  for (const p of city.plots) {
    if (p.elev === undefined) p.elev = PLOT_ELEV[p.kind];
  }
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
