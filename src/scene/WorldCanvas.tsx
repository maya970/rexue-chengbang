import { useEffect, useRef } from "react";
import { chartHeights } from "../engine/height";
import { chartOrigin, CHART, cityIdAt, npcAt, terrainAt } from "../engine/map";
import { posAt } from "../engine/path";
import type { City, World } from "../types";
import { drawBlock, inBlock, palette, project, TH, TW } from "./iso";

function kindOf(c: City): "city" | "village" | "tribe" | "ship" {
  if (c.npc) {
    const who = c.owner || "";
    if (who.includes("pirate")) return "ship";
    if (who.includes("polis")) return "city";
    if ((c.tribeLevel || 1) <= 3) return "village";
    return "tribe";
  }
  const lv = (c.buildings.acropolis?.level || 0) + (c.buildings.oikos?.level || 0);
  return lv <= 3 ? "village" : "city";
}

const MARK = {
  city: { top: "#c83828", left: "#6a1818", right: "#8a2828" },
  village: { top: "#c06048", left: "#6a3020", right: "#8a4430" },
  tribe: { top: "#8a6840", left: "#4a3020", right: "#6a4830" },
  ship: { top: "#4a90b8", left: "#204858", right: "#306878" },
};

export function WorldCanvas(props: {
  world: World;
  now: number;
  chart: { cx: number; cy: number };
  view: { x: number; y: number };
  selected: { x: number; y: number } | null;
  address: string;
  onSelect: (x: number, y: number) => void;
  onView: (x: number, y: number) => void;
  onEnterCity: (cityId: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.cursor = "grab";
    canvas.style.imageRendering = "pixelated";
    el.appendChild(canvas);
    const gfx = canvas.getContext("2d");
    if (!gfx) return;
    const ctx = gfx;
    ctx.imageSmoothingEnabled = false;

    let zoomAdd = 0;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;

    function resize() {
      const box = host.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }

    function viewSize() {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      return { cssW: canvas.width / dpr, cssH: canvas.height / dpr };
    }

    function zoomOf() {
      const { cssW, cssH } = viewSize();
      const fit = Math.min(cssW / (CHART * TW * 0.95), cssH / (CHART * TH * 1.2 + 70));
      return Math.max(0.7, Math.min(2.2, fit + zoomAdd));
    }

    function originOf() {
      return chartOrigin(latest.current.chart.cx, latest.current.chart.cy);
    }

    function cam() {
      const { view, chart } = latest.current;
      const { cssW, cssH } = viewSize();
      const zoom = zoomOf();
      const origin = chartOrigin(chart.cx, chart.cy);
      const grid = chartHeights(chart.cx, chart.cy);
      const lx = view.x - origin.x;
      const ly = view.y - origin.y;
      const elev = grid[Math.max(0, Math.min(CHART - 1, Math.floor(ly)))]?.[Math.max(0, Math.min(CHART - 1, Math.floor(lx)))] || 0;
      const mid = project(lx, ly, elev, 0, 0, zoom);
      return { cssW, cssH, zoom, ox: cssW / 2 - mid.x, oy: cssH * 0.42 - mid.y, origin, grid };
    }

    function tileAt(px: number, py: number) {
      const { ox, oy, origin, grid, zoom } = cam();
      for (let sum = CHART * 2; sum >= 0; sum -= 1) {
        for (let lx = CHART - 1; lx >= 0; lx -= 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CHART) continue;
          const elev = grid[ly][lx];
          const se = ly + 1 < CHART ? grid[ly + 1][lx] : 0;
          const drop = Math.max(1, elev - se + 1);
          const p = project(lx, ly, elev, ox, oy, zoom);
          if (inBlock(px, py, p.x, p.y, zoom, drop)) return { x: origin.x + lx, y: origin.y + ly };
        }
      }
      return origin;
    }

    function draw() {
      const { selected, world, now, address } = latest.current;
      const { cssW, cssH, ox, oy, origin, grid, zoom } = cam();
      const frame = Math.floor(now / 380) % 2;
      const walk = Math.floor(now / 220) % 2;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#071820";
      ctx.fillRect(0, 0, cssW, cssH);

      for (let sum = 0; sum <= CHART * 2; sum += 1) {
        for (let lx = 0; lx < CHART; lx += 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CHART) continue;
          const tx = origin.x + lx;
          const ty = origin.y + ly;
          const t = terrainAt(tx, ty);
          const elev = grid[ly]?.[lx] ?? 0;
          const se = ly + 1 < CHART ? (grid[ly + 1]?.[lx] ?? 0) : 0;
          const drop = t === "sea" ? 1 : Math.max(1, elev - se + 1);
          const p = project(lx, ly, elev, ox, oy, zoom);
          const pal = palette(t, frame);
          drawBlock(ctx, p.x, p.y, zoom, drop, pal.top, pal.left, pal.right);
          if (t === "forest" && elev > 0) {
            const q = project(lx, ly, elev + 1, ox, oy, zoom);
            drawBlock(ctx, q.x, q.y, zoom, 1, "#3e8a48", "#1c4a24", "#2e6a34");
          }
          if (t === "mountain" && elev > 2) {
            const q = project(lx, ly, elev + 1, ox, oy, zoom);
            drawBlock(ctx, q.x, q.y, zoom, 1, "#e8e0d4", "#6a6058", "#8a8078");
          }
        }
      }

      for (const c of Object.values(world.cities)) {
        if (c.x < origin.x || c.y < origin.y || c.x >= origin.x + CHART || c.y >= origin.y + CHART) continue;
        const lx = Math.floor(c.x - origin.x);
        const ly = Math.floor(c.y - origin.y);
        const elev = grid[ly]?.[lx] ?? 0;
        const mark = MARK[kindOf(c)];
        const q = project(lx, ly, elev + 2, ox, oy, zoom);
        drawBlock(ctx, q.x, q.y, zoom, 2, mark.top, mark.left, mark.right);
        if (c.owner === address) {
          ctx.fillStyle = "#f0c040";
          ctx.fillRect(q.x - zoom, q.y - 3 * zoom, 2 * zoom, 3 * zoom);
        }
      }

      for (const m of Object.values(world.marches)) {
        const pos = posAt(m.path, m.startAt, m.arriveAt, now);
        if (pos.x < origin.x || pos.y < origin.y || pos.x >= origin.x + CHART || pos.y >= origin.y + CHART) continue;
        const lx = pos.x - origin.x;
        const ly = pos.y - origin.y;
        const elev = grid[Math.floor(ly)]?.[Math.floor(lx)] || 0;
        const q = project(lx, ly, elev + 1, ox, oy, zoom);
        drawBlock(ctx, q.x, q.y - walk, zoom, 1, "#3868b0", "#1c3458", "#2a4c80");
      }

      if (selected && selected.x >= origin.x && selected.y >= origin.y && selected.x < origin.x + CHART && selected.y < origin.y + CHART) {
        const lx = Math.floor(selected.x - origin.x);
        const ly = Math.floor(selected.y - origin.y);
        const p = project(lx, ly, grid[ly]?.[lx] ?? 0, ox, oy, zoom);
        ctx.strokeStyle = "#f8f0a8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + (TW * zoom) / 2, p.y + (TH * zoom) / 2);
        ctx.lineTo(p.x, p.y + TH * zoom);
        ctx.lineTo(p.x - (TW * zoom) / 2, p.y + (TH * zoom) / 2);
        ctx.closePath();
        ctx.stroke();
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      try {
        draw();
      } catch {
        /* keep HUD up if a frame fails */
      }
    };
    resize();
    loop();

    function onDown(ev: PointerEvent) {
      dragging = true;
      moved = 0;
      lastX = ev.clientX;
      lastY = ev.clientY;
      canvas.style.cursor = "grabbing";
    }
    function onMove(ev: PointerEvent) {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const z = zoomOf();
      const hw = (TW * z) / 2;
      const hh = (TH * z) / 2;
      const a = dx / hw;
      const b = dy / hh;
      const origin = originOf();
      const nx = Math.min(origin.x + CHART - 2, Math.max(origin.x + 1, latest.current.view.x - (a + b) / 2));
      const ny = Math.min(origin.y + CHART - 2, Math.max(origin.y + 1, latest.current.view.y - (b - a) / 2));
      latest.current.onView(nx, ny);
      latest.current = { ...latest.current, view: { x: nx, y: ny } };
    }
    function onUp(ev: PointerEvent) {
      dragging = false;
      canvas.style.cursor = "grab";
      if (moved > 8) return;
      const r = canvas.getBoundingClientRect();
      const t = tileAt(ev.clientX - r.left, ev.clientY - r.top);
      latest.current.onSelect(t.x, t.y);
    }
    function onDbl(ev: MouseEvent) {
      const r = canvas.getBoundingClientRect();
      const t = tileAt(ev.clientX - r.left, ev.clientY - r.top);
      const id = cityIdAt(t.x, t.y);
      if (latest.current.world.cities[id]) latest.current.onEnterCity(id);
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      zoomAdd = Math.min(1.2, Math.max(-0.4, zoomAdd - Math.sign(ev.deltaY) * 0.12));
    }
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      el.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    latest.current = props;
  });

  return <div className="canvas-host pixel-map" ref={host} title="大地图：45°立体俯视，能看出山地高度" />;
}

export function tileHint(x: number, y: number) {
  return npcAt(x, y) || { name: cityIdAt(x, y), level: 0 };
}
