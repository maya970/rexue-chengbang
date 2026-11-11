import { useEffect, useRef, useState } from "react";
import { displayLevel, hamletOf, isHamlet, linkedChildrenOf, ownerColor } from "../engine/hamlets";
import { chartHeights } from "../engine/height";
import { chartOrigin, CHART, cityIdAt, npcAt, terrainAt } from "../engine/map";
import { posAt } from "../engine/path";
import { claimOwner } from "../engine/realm";
import type { World } from "../types";
import { overlaySprite, terrainSprite, TILE } from "./feTiles";
import {
  depthOf,
  drawBlockFaces,
  drawLvTag,
  inBlock,
  palette,
  project,
  textureIsoTop,
  visNeighbor,
  TH,
  TW,
} from "./iso";
import { drawCityMark } from "./isoMarks";
import { MapTools } from "./MapTools";

export type MapViewMode = "terrain" | "claims" | "realm";

function cellsOf(yaw: number, frontFirst: boolean) {
  const list: { lx: number; ly: number; d: number; rx: number }[] = [];
  for (let ly = 0; ly < CHART; ly += 1) {
    for (let lx = 0; lx < CHART; lx += 1) {
      const d = depthOf(lx, ly, yaw, CHART, CHART);
      list.push({ lx, ly, d, rx: d });
    }
  }
  list.sort((a, b) => (frontFirst ? b.d - a.d : a.d - b.d));
  return list;
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
  const [mode, setMode] = useState<MapViewMode>("terrain");
  const modeRef = useRef(mode);
  modeRef.current = mode;
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

    function elevAt(lx: number, ly: number, origin: { x: number; y: number }, grid: number[][]) {
      if (lx < 0 || ly < 0 || lx >= CHART || ly >= CHART) return 0;
      if (terrainAt(origin.x + lx, origin.y + ly) === "sea") return 0;
      return grid[ly]?.[lx] ?? 0;
    }

    function faces(lx: number, ly: number, origin: { x: number; y: number }, grid: number[][]) {
      const elev = elevAt(lx, ly, origin, grid);
      const ln = visNeighbor(lx, ly, yaw, CHART, CHART, "left");
      const rn = visNeighbor(lx, ly, yaw, CHART, CHART, "right");
      const le = elevAt(ln.x, ln.y, origin, grid);
      const re = elevAt(rn.x, rn.y, origin, grid);
      return {
        elev,
        left: Math.max(0.4, elev - le),
        right: Math.max(0.4, elev - re),
      };
    }

    function tileAt(px: number, py: number) {
      const { ox, oy, origin, grid, zoom } = cam();
      for (const c of cellsOf(yaw, true)) {
        const t = terrainAt(origin.x + c.lx, origin.y + c.ly);
        const f = t === "sea" ? { elev: 0, left: 0.25, right: 0.25 } : faces(c.lx, c.ly, origin, grid);
        const p = project(c.lx, c.ly, t === "sea" ? 0 : f.elev, ox, oy, zoom, yaw, CHART, CHART);
        if (inBlock(px, py, p.x, p.y, zoom, Math.max(f.left, f.right))) return { x: origin.x + c.lx, y: origin.y + c.ly };
      }
      return origin;
    }

    function diamond(p: { x: number; y: number }, zoom: number) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (TW * zoom) / 2, p.y + (TH * zoom) / 2);
      ctx.lineTo(p.x, p.y + TH * zoom);
      ctx.lineTo(p.x - (TW * zoom) / 2, p.y + (TH * zoom) / 2);
      ctx.closePath();
    }

    function draw() {
      const { selected, world, now, address } = latest.current;
      const { cssW, cssH, ox, oy, origin, grid, zoom } = cam();
      const frame = Math.floor(now / 380) % 2;
      const walk = Math.floor(now / 220) % 2;
      const viewMode = modeRef.current;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#0a2430";
      ctx.fillRect(0, 0, cssW, cssH);

      for (const cell of cellsOf(yaw, false)) {
        const { lx, ly } = cell;
        const tx = origin.x + lx;
        const ty = origin.y + ly;
        const t = terrainAt(tx, ty);
        const f = faces(lx, ly, origin, grid);
        const p = project(lx, ly, t === "sea" ? 0 : f.elev, ox, oy, zoom, yaw, CHART, CHART);
        const spr = terrainSprite(t, tx, ty, frame);
        if (t === "sea") {
          textureIsoTop(ctx, p.x, p.y, zoom, spr, false);
        } else {
          const pal = palette(t, frame);
          drawBlockFaces(ctx, p.x, p.y, zoom, f.left, f.right, pal.top, pal.left, pal.right);
          textureIsoTop(ctx, p.x, p.y, zoom, spr);
        }
        if (viewMode === "claims") {
          const who = claimOwner(world, tx, ty);
          if (who) {
            diamond(p, zoom);
            ctx.fillStyle = ownerColor(who, who === address ? 0.48 : 0.32);
            ctx.fill();
          }
        }
      }

      if (viewMode === "realm") {
        for (const c of Object.values(world.cities)) {
          if (isHamlet(c)) continue;
          const kids = linkedChildrenOf(world, c);
          const hue = ((c.x * 13 + c.y * 29) % 360 + 360) % 360;
          for (const k of kids) {
            if (k.x < origin.x || k.y < origin.y || k.x >= origin.x + CHART || k.y >= origin.y + CHART) continue;
            if (c.x < origin.x || c.y < origin.y || c.x >= origin.x + CHART || c.y >= origin.y + CHART) continue;
            const a = project(c.x - origin.x, c.y - origin.y, 1, ox, oy, zoom, yaw, CHART, CHART);
            const b = project(k.x - origin.x, k.y - origin.y, 1, ox, oy, zoom, yaw, CHART, CHART);
            ctx.strokeStyle = `hsla(${hue}, 55%, 62%, 0.7)`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y + TH * zoom * 0.4);
            ctx.lineTo(b.x, b.y + TH * zoom * 0.4);
            ctx.stroke();
            const kp = project(k.x - origin.x, k.y - origin.y, 0.4, ox, oy, zoom, yaw, CHART, CHART);
            diamond(kp, zoom);
            ctx.fillStyle = hamletOf(k) === "urban" ? "rgba(232,208,144,0.45)" : hamletOf(k) === "suburb" ? "rgba(200,160,96,0.4)" : "rgba(160,120,64,0.38)";
            ctx.fill();
          }
        }
      }

      const marks = Object.values(world.cities)
        .filter((c) => c.x >= origin.x && c.y >= origin.y && c.x < origin.x + CHART && c.y < origin.y + CHART)
        .sort((a, b) => depthOf(a.x - origin.x, a.y - origin.y, yaw, CHART, CHART) - depthOf(b.x - origin.x, b.y - origin.y, yaw, CHART, CHART));

      for (const c of marks) {
        const lx = Math.floor(c.x - origin.x);
        const ly = Math.floor(c.y - origin.y);
        const t = terrainAt(c.x, c.y);
        const elev = t === "sea" ? 0 : (grid[ly]?.[lx] ?? 0);
        const q = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
        drawCityMark(ctx, q.x, q.y, zoom, c, yaw);
        const lv = displayLevel(c);
        const peak = c.peakLevel || lv;
        drawLvTag(ctx, q.x, q.y - 16 * zoom, zoom, lv, peak);
        if (c.owner === address) {
          ctx.drawImage(overlaySprite("flag"), q.x + 6 * zoom, q.y - 22 * zoom, 8 * zoom, 8 * zoom);
        }
      }

      for (const m of Object.values(world.marches).sort((a, b) => {
        const pa = posAt(a.path, a.startAt, a.arriveAt, now);
        const pb = posAt(b.path, b.startAt, b.arriveAt, now);
        return depthOf(pa.x - origin.x, pa.y - origin.y, yaw, CHART, CHART) - depthOf(pb.x - origin.x, pb.y - origin.y, yaw, CHART, CHART);
      })) {
        const pos = posAt(m.path, m.startAt, m.arriveAt, now);
        if (pos.x < origin.x || pos.y < origin.y || pos.x >= origin.x + CHART || pos.y >= origin.y + CHART) continue;
        const lx = pos.x - origin.x;
        const ly = pos.y - origin.y;
        const t = terrainAt(Math.floor(pos.x), Math.floor(pos.y));
        const elev = t === "sea" ? 0 : (grid[Math.floor(ly)]?.[Math.floor(lx)] || 0);
        const q = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
        ctx.drawImage(overlaySprite("army", walk), q.x - 8 * zoom, q.y + 2 * zoom - walk * 0.2, TILE * zoom * 0.7, TILE * zoom * 0.7);
      }

      if (selected && selected.x >= origin.x && selected.y >= origin.y && selected.x < origin.x + CHART && selected.y < origin.y + CHART) {
        const lx = Math.floor(selected.x - origin.x);
        const ly = Math.floor(selected.y - origin.y);
        const t = terrainAt(selected.x, selected.y);
        const elev = t === "sea" ? 0 : (grid[ly]?.[lx] ?? 0);
        const p = project(lx, ly, elev, ox, oy, zoom, yaw, CHART, CHART);
        ctx.strokeStyle = "#f8f0a8";
        ctx.lineWidth = 2;
        diamond(p, zoom);
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
        extra={(
          <>
            <button className={`btn tiny${mode === "terrain" ? " primary" : ""}`} type="button" onClick={() => setMode("terrain")}>地形</button>
            <button className={`btn tiny${mode === "claims" ? " primary" : ""}`} type="button" onClick={() => setMode("claims")}>连通图</button>
            <button className={`btn tiny${mode === "realm" ? " primary" : ""}`} type="button" onClick={() => setMode("realm")}>城域</button>
          </>
        )}
      />
    </div>
  );
}

export function tileHint(x: number, y: number) {
  return npcAt(x, y) || { name: cityIdAt(x, y), level: 0 };
}
