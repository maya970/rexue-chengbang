import { useEffect, useRef } from "react";
import { chartOrigin, CHART, cityIdAt, npcAt, terrainAt } from "../engine/map";
import { posAt } from "../engine/path";
import type { City, World } from "../types";
import { blit, drawFeCursor, overlaySprite, terrainSprite, TILE } from "./feTiles";

function kindOf(c: City): "city" | "village" | "tribe" | "ship" {
  if (c.npc) {
    if (c.owner.includes("pirate")) return "ship";
    if (c.owner.includes("polis")) return "city";
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

    let zoom = 3;
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;

    function tilePx() {
      return TILE * zoom;
    }

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

    function tileAt(px: number, py: number) {
      const { view } = latest.current;
      const { cssW, cssH } = viewSize();
      const s = tilePx();
      const ox = view.x - cssW / s / 2;
      const oy = view.y - cssH / s / 2;
      return { x: Math.floor(ox + px / s), y: Math.floor(oy + py / s) };
    }

    function draw() {
      const { view, selected, world, now, address, chart } = latest.current;
      const { cssW, cssH } = viewSize();
      const s = tilePx();
      const frame = Math.floor(now / 380) % 2;
      const walk = Math.floor(now / 220) % 2;
      const ox = view.x - cssW / s / 2;
      const oy = view.y - cssH / s / 2;
      const startX = Math.floor(ox);
      const startY = Math.floor(oy);
      const shiftX = Math.round((startX - ox) * s);
      const shiftY = Math.round((startY - oy) * s);
      const cols = Math.ceil(cssW / s) + 2;
      const rows = Math.ceil(cssH / s) + 2;
      const origin = chartOrigin(chart.cx, chart.cy);

      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#082438";
      ctx.fillRect(0, 0, cssW, cssH);

      for (let j = 0; j < rows; j += 1) {
        for (let k = 0; k < cols; k += 1) {
          const tx = startX + k;
          const ty = startY + j;
          if (tx < origin.x || ty < origin.y || tx >= origin.x + CHART || ty >= origin.y + CHART) continue;
          const t = terrainAt(tx, ty);
          const spr = terrainSprite(t, tx, ty, frame);
          blit(ctx, spr, k * s + shiftX, j * s + shiftY, zoom);
        }
      }

      ctx.fillStyle = "rgba(16, 24, 12, 0.18)";
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(0, j * s + shiftY, cssW, 1);
      }
      for (let k = 0; k < cols; k += 1) {
        ctx.fillRect(k * s + shiftX, 0, 1, cssH);
      }

      for (const c of Object.values(world.cities)) {
        if (c.x < origin.x || c.y < origin.y || c.x >= origin.x + CHART || c.y >= origin.y + CHART) continue;
        const px = Math.round((c.x - ox) * s);
        const py = Math.round((c.y - oy) * s);
        if (px < -s || py < -s || px > cssW || py > cssH) continue;
        blit(ctx, overlaySprite(kindOf(c)), px, py, zoom);
        if (c.owner === address) blit(ctx, overlaySprite("flag"), px, py, zoom);
      }

      for (const m of Object.values(world.marches)) {
        const p = posAt(m.path, m.startAt, m.arriveAt, now);
        const px = Math.round((p.x - ox) * s);
        const py = Math.round((p.y - oy) * s) - walk;
        blit(ctx, overlaySprite("army", walk), px, py, zoom);
      }

      if (selected) {
        const sx = Math.round((selected.x - ox) * s);
        const sy = Math.round((selected.y - oy) * s);
        drawFeCursor(ctx, sx, sy, s, now);
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw();
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
      const s = tilePx();
      const origin = chartOrigin(latest.current.chart.cx, latest.current.chart.cy);
      const nx = Math.min(origin.x + CHART - 2, Math.max(origin.x + 1, latest.current.view.x - dx / s));
      const ny = Math.min(origin.y + CHART - 2, Math.max(origin.y + 1, latest.current.view.y - dy / s));
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
      zoom = Math.min(5, Math.max(2, zoom - Math.sign(ev.deltaY)));
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

  return <div className="canvas-host pixel-map" ref={host} title="本张大地图外圈是海。拖动只在本图内，邻图用上下左右或超大地图进入" />;
}

export function tileHint(x: number, y: number) {
  return npcAt(x, y) || { name: cityIdAt(x, y), level: 0 };
}
