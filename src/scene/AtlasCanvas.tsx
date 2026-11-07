import { useEffect, useRef } from "react";
import { chartName, chartOf, CHART, islandCount, terrainAt } from "../engine/map";

export function AtlasCanvas(props: {
  chart: { cx: number; cy: number };
  cities: { x: number; y: number; mine: boolean }[];
  onEnter: (cx: number, cy: number) => void;
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
    canvas.style.cursor = "grab";
    el.appendChild(canvas);
    const gfx = canvas.getContext("2d");
    if (!gfx) return;
    const ctx = gfx;
    let panX = props.chart.cx;
    let panY = props.chart.cy;
    let follow = { cx: props.chart.cx, cy: props.chart.cy };
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;
    let raf = 0;
    const cell = 52;

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

    function size() {
      const dpr = Math.max(1, Math.round(devicePixelRatio || 1));
      return { w: canvas.width / dpr, h: canvas.height / dpr };
    }

    function drawMini(cx: number, cy: number, px: number, py: number, s: number) {
      const step = CHART / 8;
      for (let j = 0; j < 8; j += 1) {
        for (let i = 0; i < 8; i += 1) {
          const t = terrainAt(Math.floor(cx * CHART + i * step + step / 2), Math.floor(cy * CHART + j * step + step / 2));
          ctx.fillStyle = t === "sea" ? "#165a82" : t === "coast" ? "#d2b070" : t === "forest" ? "#2d6a38" : t === "mountain" ? "#8a8070" : "#6aa050";
          ctx.fillRect(px + i * (s / 8), py + j * (s / 8), s / 8, s / 8);
        }
      }
    }

    function draw() {
      const { chart, cities } = latest.current;
      if (chart.cx !== follow.cx || chart.cy !== follow.cy) {
        panX = chart.cx;
        panY = chart.cy;
        follow = chart;
      }
      const { w, h } = size();
      ctx.fillStyle = "#081820";
      ctx.fillRect(0, 0, w, h);
      const cols = Math.ceil(w / cell) + 2;
      const rows = Math.ceil(h / cell) + 2;
      const ox = panX - w / cell / 2;
      const oy = panY - h / cell / 2;
      const sx = Math.floor(ox);
      const sy = Math.floor(oy);
      const shx = (sx - ox) * cell;
      const shy = (sy - oy) * cell;
      for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          const cx = sx + i;
          const cy = sy + j;
          const px = i * cell + shx + 3;
          const py = j * cell + shy + 3;
          const inner = cell - 6;
          drawMini(cx, cy, px, py, inner);
          if (cx === chart.cx && cy === chart.cy) {
            ctx.strokeStyle = "#f3d9a0";
            ctx.lineWidth = 2;
            ctx.strokeRect(px - 1, py - 1, inner + 2, inner + 2);
          }
          if (islandCount(cx, cy) === 2) {
            ctx.fillStyle = "#f3d9a0";
            ctx.fillRect(px + inner - 5, py + 2, 3, 3);
          }
        }
      }
      for (const c of cities) {
        const ch = chartOf(c.x, c.y);
        const px = (ch.cx - ox) * cell + cell / 2;
        const py = (ch.cy - oy) * cell + cell / 2;
        ctx.fillStyle = c.mine ? "#f0c040" : "#c04030";
        ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      draw();
    };
    resize();
    loop();

    function cellAt(px: number, py: number) {
      const { w, h } = size();
      const ox = panX - w / cell / 2;
      const oy = panY - h / cell / 2;
      return { cx: Math.floor(ox + px / cell), cy: Math.floor(oy + py / cell) };
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
      panX -= dx / cell;
      panY -= dy / cell;
    }
    function onUp(ev: PointerEvent) {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      if (moved > 8) return;
      const r = canvas.getBoundingClientRect();
      const t = cellAt(ev.clientX - r.left, ev.clientY - r.top);
      latest.current.onEnter(t.cx, t.cy);
    }
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
      el.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    latest.current = props;
  });

  return (
    <div className="atlas-wrap">
      <div className="atlas-label">
        超大地图（俯视总览，不立体） · {chartName(props.chart.cx, props.chart.cy)} ({props.chart.cx},{props.chart.cy}) · 点一块进入立体大地图
      </div>
      <div className="canvas-host pixel-map atlas-host" ref={host} />
    </div>
  );
}
