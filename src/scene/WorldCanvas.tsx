import { useEffect, useRef } from "react";
import { chartHeights } from "../engine/height";
import { chartOrigin, CHART, cityIdAt, npcAt, terrainAt } from "../engine/map";
import { posAt } from "../engine/path";
import type { City, World } from "../types";
import { overlaySprite, terrainSprite, TILE } from "./feTiles";
import { drawBlock, drawIsoSprite, inBlock, landDrop, palette, project, textureIsoTop, TH, TW } from "./iso";
import { MapTools } from "./MapTools";

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
    canvas.style.cursor = "grab";
    canvas.style.imageRendering = "pixelated";
    el.appendChild(canvas);
    const gfx = canvas.getContext("2d");
    if (!gfx) return;
    const ctx = gfx;
    ctx.imageSmoothingEnabled = false;

    let zoomAdd = 0;
    let yaw = 0;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    let follow = { x: props.view.x, y: props.view.y, cx: props.chart.cx, cy: props.chart.cy };
    let lastPush = { x: props.view.x, y: props.view.y };
    let focus = { x: props.view.x, y: props.view.y };

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
      return Math.max(0.45, Math.min(3.4, fit + zoomAdd));
    }

    function originOf() {
      return chartOrigin(latest.current.chart.cx, latest.current.chart.cy);
    }

    function cam() {
      const { view, chart } = latest.current;
      if (chart.cx !== follow.cx || chart.cy !== follow.cy || Math.hypot(view.x - lastPush.x, view.y - lastPush.y) > 0.6) {
        follow = { x: view.x, y: view.y, cx: chart.cx, cy: chart.cy };
        lastPush = { x: view.x, y: view.y };
        focus = { x: view.x, y: view.y };
        panX = 0;
        panY = 0;
      }
      const { cssW, cssH } = viewSize();
      const zoom = zoomOf();
      const origin = chartOrigin(chart.cx, chart.cy);
      const grid = chartHeights(chart.cx, chart.cy);
      const lx = focus.x - origin.x;
      const ly = focus.y - origin.y;
      const elev = grid[Math.max(0, Math.min(CHART - 1, Math.floor(ly)))]?.[Math.max(0, Math.min(CHART - 1, Math.floor(lx)))] || 0;
      const mid = project(lx, ly, elev, 0, 0, zoom, yaw, CHART, CHART);
      return { cssW, cssH, zoom, ox: cssW / 2 - mid.x + panX, oy: cssH * 0.42 - mid.y + panY, origin, grid };
    }

    function pushView(x: number, y: number) {
      lastPush = { x, y };
      latest.current.onView(x, y);
      latest.current = { ...latest.current, view: { x, y } };
    }

    function tileAt(px: number, py: number) {
      const { ox, oy, origin, grid, zoom } = cam();
      for (let sum = CHART * 2; sum >= 0; sum -= 1) {
        for (let lx = CHART - 1; lx >= 0; lx -= 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CHART) continue;
          const elev = grid[ly]?.[lx] ?? 0;
          const se = ly + 1 < CHART ? (grid[ly + 1]?.[lx] ?? 0) : 0;
          const t = terrainAt(origin.x + lx, origin.y + ly);
          const drop = t === "sea" ? 0.25 : landDrop(elev, se);
          const p = project(lx, ly, t === "sea" ? 0 : elev, ox, oy, zoom, yaw, CHART, CHART);
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
      ctx.fillStyle = "#0a2430";
      ctx.fillRect(0, 0, cssW, cssH);

      for (let sum = 0; sum <= CHART * 2; sum += 1) {
        for (let lx = 0; lx < CHART; lx += 1) {
          const ly = sum - lx;
          if (ly < 0 || ly >= CHART) continue;
          const tx = origin.x + lx;
          const ty = origin.y + ly;
          const t = terrainAt(tx, ty);
          const elev = t === "sea" ? 0 : (grid[ly]?.[lx] ?? 0);
          const se = ly + 1 < CHART && terrainAt(tx, ty + 1) !== "sea" ? (grid[ly + 1]?.[lx] ?? 0) : 0;
          const p = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
          const spr = terrainSprite(t, tx, ty, frame);
          if (t === "sea") {
            textureIsoTop(ctx, p.x, p.y, zoom, spr, false);
            continue;
          }
          const pal = palette(t, frame);
          drawBlock(ctx, p.x, p.y, zoom, landDrop(elev, se), pal.top, pal.left, pal.right);
          textureIsoTop(ctx, p.x, p.y, zoom, spr);
        }
      }

      for (const c of Object.values(world.cities)) {
        if (c.x < origin.x || c.y < origin.y || c.x >= origin.x + CHART || c.y >= origin.y + CHART) continue;
        const lx = Math.floor(c.x - origin.x);
        const ly = Math.floor(c.y - origin.y);
        const t = terrainAt(c.x, c.y);
        const elev = t === "sea" ? 0 : (grid[ly]?.[lx] ?? 0);
        const q = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
        const kind = kindOf(c);
        drawIsoSprite(ctx, q.x, q.y, zoom, overlaySprite(kind), TILE, 0.9);
        if (c.owner === address) {
          drawIsoSprite(ctx, q.x + 3 * zoom, q.y, zoom * 0.85, overlaySprite("flag"), 8, 0.42);
        }
      }

      for (const m of Object.values(world.marches)) {
        const pos = posAt(m.path, m.startAt, m.arriveAt, now);
        if (pos.x < origin.x || pos.y < origin.y || pos.x >= origin.x + CHART || pos.y >= origin.y + CHART) continue;
        const lx = pos.x - origin.x;
        const ly = pos.y - origin.y;
        const t = terrainAt(Math.floor(pos.x), Math.floor(pos.y));
        const elev = t === "sea" ? 0 : (grid[Math.floor(ly)]?.[Math.floor(lx)] || 0);
        const q = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
        drawIsoSprite(ctx, q.x, q.y - walk, zoom, overlaySprite("army", walk), TILE, 0.9);
      }

      if (selected && selected.x >= origin.x && selected.y >= origin.y && selected.x < origin.x + CHART && selected.y < origin.y + CHART) {
        const lx = Math.floor(selected.x - origin.x);
        const ly = Math.floor(selected.y - origin.y);
        const t = terrainAt(selected.x, selected.y);
        const elev = t === "sea" ? 0 : (grid[ly]?.[lx] ?? 0);
        const p = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
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
      canvas.setPointerCapture?.(ev.pointerId);
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
      const { cssW, cssH } = viewSize();
      const t = tileAt(cssW / 2, cssH / 2);
      const origin = originOf();
      const nx = Math.min(origin.x + CHART - 2, Math.max(origin.x + 1, t.x));
      const ny = Math.min(origin.y + CHART - 2, Math.max(origin.y + 1, t.y));
      pushView(nx, ny);
    }
    function onUp(ev: PointerEvent) {
      if (!dragging) return;
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
      zoomAdd = Math.min(2.2, Math.max(-0.85, zoomAdd - Math.sign(ev.deltaY) * 0.14));
    }
    camRef.current = {
      zoomIn: () => { zoomAdd = Math.min(2.2, zoomAdd + 0.18); },
      zoomOut: () => { zoomAdd = Math.max(-0.85, zoomAdd - 0.18); },
      rotate: () => { yaw = (yaw + 1) & 3; },
      reset: () => { yaw = 0; zoomAdd = 0; panX = 0; panY = 0; },
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("dblclick", onDbl);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("dblclick", onDbl);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", resize);
      el.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    latest.current = props;
  });

  return (
    <div className="canvas-host pixel-map" title="拖动平移 · 滚轮缩放 · 转视角">
      <div className="canvas-fill" ref={host} />
      <MapTools
        title="大地图"
        onZoomIn={() => camRef.current.zoomIn()}
        onZoomOut={() => camRef.current.zoomOut()}
        onRotate={() => camRef.current.rotate()}
        onReset={() => camRef.current.reset()}
      />
    </div>
  );
}

export function tileHint(x: number, y: number) {
  return npcAt(x, y) || { name: cityIdAt(x, y), level: 0 };
}
