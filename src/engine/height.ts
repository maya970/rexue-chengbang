import { CHART, terrainAt } from "./map";

/** Adjacent tiles differ by at most 1: peaks raise a slope, never a floating block. */
export function raiseConnect(grid: number[][], blocked?: (x: number, y: number) => boolean) {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let changed = true;
  let guard = 0;
  while (changed && guard < w * h * 4) {
    changed = false;
    guard += 1;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (blocked?.(x, y)) continue;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (blocked?.(nx, ny)) continue;
          if (grid[ny][nx] < grid[y][x] - 1) {
            grid[ny][nx] = grid[y][x] - 1;
            changed = true;
          }
        }
      }
    }
  }
  return grid;
}

const chartCache = new Map<string, number[][]>();

function rawElev(t: ReturnType<typeof terrainAt>) {
  if (t === "sea") return 0;
  if (t === "coast") return 1;
  if (t === "plain") return 2;
  if (t === "forest") return 3;
  return 5;
}

export function chartHeights(cx: number, cy: number): number[][] {
  const key = `${cx}:${cy}`;
  const hit = chartCache.get(key);
  if (hit) return hit;
  const ox = cx * CHART;
  const oy = cy * CHART;
  const grid: number[][] = [];
  for (let ly = 0; ly < CHART; ly += 1) {
    grid[ly] = [];
    for (let lx = 0; lx < CHART; lx += 1) {
      grid[ly][lx] = rawElev(terrainAt(ox + lx, oy + ly));
    }
  }
  const sea = (x: number, y: number) => terrainAt(ox + x, oy + y) === "sea";
  const dist: number[][] = grid.map((row) => row.map(() => 99));
  const q: { x: number; y: number }[] = [];
  for (let y = 0; y < CHART; y += 1) {
    for (let x = 0; x < CHART; x += 1) {
      if (!sea(x, y)) continue;
      dist[y][x] = 0;
      q.push({ x, y });
    }
  }
  for (let i = 0; i < q.length; i += 1) {
    const { x, y } = q[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= CHART || ny >= CHART) continue;
      const nd = dist[y][x] + 1;
      if (nd < dist[ny][nx]) {
        dist[ny][nx] = nd;
        q.push({ x: nx, y: ny });
      }
    }
  }
  for (let y = 0; y < CHART; y += 1) {
    for (let x = 0; x < CHART; x += 1) {
      if (sea(x, y)) grid[y][x] = 0;
      else grid[y][x] = Math.min(grid[y][x], dist[y][x]);
    }
  }
  raiseConnect(grid, sea);
  chartCache.set(key, grid);
  return grid;
}

