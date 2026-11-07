import { useEffect, useRef } from "react";
import { BUILDINGS, CITY_H, CITY_W, PLOT_NAME } from "../engine/catalog";
import { isCityRoad } from "../engine/plots";
import type { BuildingId, Card, City, World } from "../types";
import { blitCity, buildingTile, CTILE, emptyTile, grassTile, roadTile, walkerTile } from "./cityPixel";

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

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.imageRendering = "pixelated";
    canvas.style.cursor = "pointer";
    el.appendChild(canvas);
    const gfx = canvas.getContext("2d");
    if (!gfx) return;
    const ctx = gfx;
    let raf = 0;
    let zoom = 3;

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

    function layout() {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      const s = CTILE * zoom;
      const ox = Math.floor((cssW - CITY_W * s) / 2);
      const oy = Math.floor((cssH - CITY_H * s) / 2);
      return { cssW, cssH, s, ox, oy };
    }

    function walkers(now: number): { card: Card; x: number; y: number; flip: boolean; frame: number }[] {
      const { city, world } = latest.current;
      const cards = Object.values(world.cards).filter((c) => c.cityId === city.id && !c.marchId && (c.kind === "person" || c.kind === "slave"));
      const s = CTILE * zoom;
      const { ox, oy } = layout();
      const frame = Math.floor(now / 180) % 2;
      return cards.map((card, i) => {
        const along = (now / 280 + i * 19) % (CITY_W * 2);
        const ping = along < CITY_W ? along : CITY_W * 2 - along;
        const flip = along >= CITY_W;
        const lx = ping;
        const ly = 4 + ((i % 3) - 1) * 0.12;
        return {
          card,
          x: ox + lx * s,
          y: oy + ly * s - (frame && !flip ? 1 : 0),
          flip,
          frame,
        };
      });
    }

    function draw() {
      const { city, now } = latest.current;
      const { cssW, cssH, s, ox, oy } = layout();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#1a2418";
      ctx.fillRect(0, 0, cssW, cssH);
      for (let ly = 0; ly < CITY_H; ly += 1) {
        for (let lx = 0; lx < CITY_W; lx += 1) {
          const px = ox + lx * s;
          const py = oy + ly * s;
          if (isCityRoad(lx, ly)) blitCity(ctx, roadTile(), px, py, zoom);
          else blitCity(ctx, grassTile(), px, py, zoom);
        }
      }
      for (const plot of city.plots || []) {
        const px = ox + plot.lx * s;
        const py = oy + plot.ly * s;
        blitCity(ctx, emptyTile(plot.kind), px, py, zoom);
        if (plot.building) blitCity(ctx, buildingTile(plot.building), px, py, zoom);
      }
      for (const w of walkers(now)) {
        blitCity(ctx, walkerTile(w.card.kind === "slave", w.frame), w.x, w.y, zoom, w.flip);
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw();
    };
    resize();
    loop();

    function onClick(ev: PointerEvent) {
      const r = canvas.getBoundingClientRect();
      const { s, ox, oy } = layout();
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const near = walkers(latest.current.now).find((w) => px >= w.x && px < w.x + s && py >= w.y && py < w.y + s);
      if (near) {
        latest.current.onCard(near.card.id);
        return;
      }
      const lx = Math.floor((px - ox) / s);
      const ly = Math.floor((py - oy) / s);
      const plot = (latest.current.city.plots || []).find((p) => p.lx === lx && p.ly === ly);
      if (!plot) return;
      if (plot.building) latest.current.onBuilding(plot.building, plot.id);
      else latest.current.onPlot(plot.id);
    }
    canvas.addEventListener("pointerdown", onClick);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onClick);
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
    <div className="canvas-host city-canvas pixel-map" ref={host}>
      <div className="city-caption">
        {props.city.name} · 空地 {built}/{cap} · 点空地建造，点人打开名册
        {" · "}
        {Object.values(props.world.cards).filter((c) => c.cityId === props.city.id && !c.marchId && (c.kind === "person" || c.kind === "slave")).length} 人在街上走
        {" · "}
        {BUILDINGS.acropolis.name}/{PLOT_NAME.housing}
      </div>
    </div>
  );
}
