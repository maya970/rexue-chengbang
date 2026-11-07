import { useEffect, useRef } from "react";
import { BUILDINGS, CITY_H, CITY_W } from "../engine/catalog";
import { cityHeightGrid, isCityRoad } from "../engine/plots";
import type { BuildingId, City, World } from "../types";
import { blitCity, buildingTile, emptyTile, grassTile, roadTile, walkerTile } from "./cityPixel";
import { drawBlock, drawIsoSprite, inBlock, landDrop, palette, project, textureIsoTop } from "./iso";
import { MapTools } from "./MapTools";

const ROOF: Record<BuildingId, { top: string; left: string; right: string }> = {
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

export function CityCanvas(props: {
  city: City;
  world: World;
  now: number;
  onPlot: (plotId: string) => void;
  onBuilding: (id: BuildingId, plotId: string) => void;
  onCard: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const camRef = useRef({
    zoomIn: () => {},
    zoomOut: () => {},
    rotate: () => {},
    reset: () => {},
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";
    canvas.style.cursor = "grab";
    el.appendChild(canvas);
    const gfx = canvas.getContext("2d");
    if (!gfx) return;
    const ctx = gfx;
    let raf = 0;
    let zoom = 2.1;
    let yaw = 0;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

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

    function cam() {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      const mid = project((CITY_W - 1) / 2, (CITY_H - 1) / 2, 1, 0, 0, zoom, yaw, CITY_W, CITY_H);
      return { cssW, cssH, ox: cssW / 2 - mid.x + panX, oy: cssH * 0.28 - mid.y + panY };
    }

    function heights() {
      return cityHeightGrid(latest.current.city);
    }

    function walkers(now: number) {
      const { city, world } = latest.current;
      const grid = heights();
      const { ox, oy } = cam();
      const cards = Object.values(world.cards).filter((c) => c.cityId === city.id && !c.marchId && (c.kind === "person" || c.kind === "slave"));
      const frame = Math.floor(now / 180) % 2;
      return cards.map((card, i) => {
        const along = (now / 280 + i * 19) % (CITY_W * 2);
        const ping = along < CITY_W ? along : CITY_W * 2 - along;
        const flip = along >= CITY_W;
        const lx = ping;
        const ly = 4;
        const elev = grid[ly]?.[Math.floor(lx)] || 1;
        const p = project(lx, ly, elev, ox, oy, zoom, yaw, CITY_W, CITY_H);
        return { card, x: p.x - 8 * zoom, y: p.y - 4 * zoom, flip, frame, order: lx + ly };
      });
    }

    function draw() {
      const { city, now } = latest.current;
      const { cssW, cssH, ox, oy } = cam();
      const grid = heights();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#152018";
      ctx.fillRect(0, 0, cssW, cssH);
      const plotAt = (lx: number, ly: number) => (city.plots || []).find((p) => p.lx === lx && p.ly === ly);
      for (let sum = 0; sum <= CITY_W + CITY_H; sum += 1) {
        for (let lx = 0; lx < CITY_W; lx += 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CITY_H) continue;
          const elev = grid[ly]?.[lx] ?? 0;
          const se = ly + 1 < CITY_H ? (grid[ly + 1]?.[lx] ?? 0) : 0;
          const water = elev <= 0;
          const p = project(lx, ly, water ? 0 : elev, ox, oy, zoom, yaw, CITY_W, CITY_H);
          const plot = plotAt(lx, ly);
          const ground = isCityRoad(lx, ly) ? roadTile() : plot ? emptyTile(plot.kind) : grassTile();
          if (water) {
            textureIsoTop(ctx, p.x, p.y, zoom, ground);
          } else {
            const pal = isCityRoad(lx, ly) ? palette("road") : palette("plot");
            drawBlock(ctx, p.x, p.y, zoom, landDrop(elev, se), pal.top, pal.left, pal.right);
            textureIsoTop(ctx, p.x, p.y, zoom, ground);
          }
          if (plot?.building) {
            const roof = ROOF[plot.building];
            const q = project(lx, ly, water ? 0.4 : elev + 1.15, ox, oy, zoom, yaw, CITY_W, CITY_H);
            if (!water) {
              drawBlock(ctx, q.x, q.y, zoom, 1, roof.top, roof.left, roof.right);
            }
            drawIsoSprite(ctx, q.x, q.y, zoom, buildingTile(plot.building), 16, 0.38);
          }
        }
      }
      for (const w of walkers(now).sort((a, b) => a.order - b.order)) {
        blitCity(ctx, walkerTile(w.card.kind === "slave", w.frame), w.x, w.y, zoom, w.flip);
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw();
    };
    resize();
    loop();

    function hit(ev: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const { ox, oy } = cam();
      const grid = heights();
      const near = walkers(latest.current.now).reverse().find((w) => px >= w.x && px < w.x + 16 * zoom && py >= w.y && py < w.y + 16 * zoom);
      if (near) {
        latest.current.onCard(near.card.id);
        return;
      }
      const city = latest.current.city;
      for (let sum = CITY_W + CITY_H; sum >= 0; sum -= 1) {
        for (let lx = CITY_W - 1; lx >= 0; lx -= 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CITY_H) continue;
          const elev = grid[ly]?.[lx] ?? 0;
          const se = ly + 1 < CITY_H ? (grid[ly + 1]?.[lx] ?? 0) : 0;
          const drop = elev <= 0 ? 0.25 : landDrop(elev, se);
          const p = project(lx, ly, elev <= 0 ? 0 : elev, ox, oy, zoom, yaw, CITY_W, CITY_H);
          if (!inBlock(px, py, p.x, p.y, zoom, drop)) continue;
          const plot = (city.plots || []).find((pl) => pl.lx === lx && pl.ly === ly);
          if (!plot) return;
          if (plot.building) latest.current.onBuilding(plot.building, plot.id);
          else latest.current.onPlot(plot.id);
          return;
        }
      }
    }
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
      panX += dx;
      panY += dy;
    }
    function onUp(ev: PointerEvent) {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      if (moved > 8) return;
      hit(ev);
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      zoom = Math.min(4.8, Math.max(0.85, zoom - Math.sign(ev.deltaY) * 0.16));
    }
    camRef.current = {
      zoomIn: () => { zoom = Math.min(4.8, zoom + 0.2); },
      zoomOut: () => { zoom = Math.max(0.85, zoom - 0.2); },
      rotate: () => { yaw = (yaw + 1) & 3; },
      reset: () => { yaw = 0; zoom = 2.1; panX = 0; panY = 0; },
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      el.removeChild(canvas);
    };
  }, [props.city.id]);

  useEffect(() => {
    latest.current = props;
  });

  const built = (props.city.plots || []).filter((p) => p.building).length;
  const cap = (props.city.plots || []).length;

  return (
    <div className="canvas-host city-canvas pixel-map">
      <div className="canvas-fill" ref={host} />
      <MapTools
        title="城市地图"
        onZoomIn={() => camRef.current.zoomIn()}
        onZoomOut={() => camRef.current.zoomOut()}
        onRotate={() => camRef.current.rotate()}
        onReset={() => camRef.current.reset()}
      />
      <div className="city-caption">
        {props.city.name} · 拖动 / 滚轮缩放 / 转视角 · {built}/{cap}
        {" · "}
        {BUILDINGS.acropolis.name}
        {" · "}点空地建造
      </div>
    </div>
  );
}
