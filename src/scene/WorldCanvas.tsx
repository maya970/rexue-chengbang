import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cityIdAt, npcAt, terrainAt } from "../engine/map";
import { posAt } from "../engine/path";
import type { World } from "../types";

const TILE = 4;
const SPAN = 22;

function colorOf(x: number, y: number): number {
  const t = terrainAt(x, y);
  if (t === "sea") return 0x2a7a96;
  if (t === "coast") return 0xe0c08a;
  if (t === "forest") return 0x3f7a4c;
  if (t === "mountain") return 0x8a8276;
  return 0x86b05f;
}

function heightOf(x: number, y: number): number {
  const t = terrainAt(x, y);
  if (t === "sea") return 0.35;
  if (t === "coast") return 0.55;
  if (t === "mountain") return 2.4;
  if (t === "forest") return 0.95;
  return 0.7;
}

export function WorldCanvas(props: {
  world: World;
  now: number;
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1418);
    scene.fog = new THREE.FogExp2(0x0b1418, 0.012);

    const camera = new THREE.PerspectiveCamera(48, el.clientWidth / el.clientHeight, 0.1, 400);
    camera.position.set(18, 28, 28);

    const sun = new THREE.DirectionalLight(0xffe6c4, 2.1);
    sun.position.set(30, 55, 22);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xb7d7ee, 0x4a3824, 1.05));
    scene.add(new THREE.AmbientLight(0x6a5a44, 0.7));

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshStandardMaterial({ color: 0x143848, roughness: 0.35, metalness: 0.1 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.05;
    scene.add(water);

    const tileGeo = new THREE.BoxGeometry(TILE * 0.96, 1, TILE * 0.96);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04 });
    const tiles = new THREE.InstancedMesh(tileGeo, tileMat, SPAN * SPAN);
    tiles.castShadow = true;
    tiles.receiveShadow = true;
    scene.add(tiles);

    const citiesGroup = new THREE.Group();
    scene.add(citiesGroup);
    const actors = new THREE.Group();
    scene.add(actors);

    const marker = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.7, 24),
      new THREE.MeshBasicMaterial({ color: 0xf3d9a0, side: THREE.DoubleSide }),
    );
    marker.rotation.x = -Math.PI / 2;
    scene.add(marker);

    const look = new THREE.Vector3();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let dirty = true;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    function syncTiles() {
      const { view } = latest.current;
      const ox = view.x - Math.floor(SPAN / 2);
      const oy = view.y - Math.floor(SPAN / 2);
      let i = 0;
      for (let j = 0; j < SPAN; j += 1) {
        for (let k = 0; k < SPAN; k += 1) {
          const x = ox + k;
          const y = oy + j;
          const h = heightOf(x, y);
          dummy.position.set(x * TILE, h / 2, y * TILE);
          dummy.scale.set(1, h, 1);
          dummy.updateMatrix();
          tiles.setMatrixAt(i, dummy.matrix);
          color.setHex(colorOf(x, y));
          tiles.setColorAt(i, color);
          i += 1;
        }
      }
      tiles.instanceMatrix.needsUpdate = true;
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      look.set(view.x * TILE, 0, view.y * TILE);
    }

    const templeGeo = new THREE.CylinderGeometry(1.1, 1.4, 2.2, 8);
    const hutGeo = new THREE.ConeGeometry(1.3, 1.8, 5);
    const poleGeo = new THREE.SphereGeometry(0.55, 10, 10);
    const marble = new THREE.MeshStandardMaterial({ color: 0xe8d9b8, roughness: 0.45 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x8a4a28, roughness: 0.7 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd4b45a, roughness: 0.4 });
    const bone = new THREE.MeshStandardMaterial({ color: 0xc2b49a, roughness: 0.55 });
    const enemy = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, roughness: 0.5 });

    function syncCities() {
      citiesGroup.clear();
      const { world, address } = latest.current;
      for (const c of Object.values(world.cities)) {
        const g = new THREE.Group();
        g.position.set(c.x * TILE, heightOf(c.x, c.y), c.y * TILE);
        const mesh = new THREE.Mesh(c.npc ? (c.tribeLevel && c.tribeLevel > 8 ? templeGeo : hutGeo) : templeGeo, c.npc ? (c.owner.includes("tribe") || c.owner.includes("camp") ? rust : enemy) : marble);
        mesh.castShadow = true;
        mesh.userData = { cityId: c.id, x: c.x, y: c.y };
        g.add(mesh);
        const flag = new THREE.Mesh(poleGeo, c.owner === address ? gold : bone);
        flag.position.y = 1.8;
        g.add(flag);
        if (c.tribeLevel) {
          const lv = Math.min(1.6, 0.5 + c.tribeLevel * 0.08);
          mesh.scale.setScalar(lv);
        }
        citiesGroup.add(g);
      }
    }

    const marchGeo = new THREE.SphereGeometry(0.45, 12, 12);
    const marchMat = new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0x664400 });
    const npcMarch = new THREE.MeshStandardMaterial({ color: 0xff6a4a, emissive: 0x401000 });

    function syncActors(now: number) {
      actors.clear();
      for (const m of Object.values(latest.current.world.marches)) {
        const p = posAt(m.path, m.startAt, m.arriveAt, now);
        const ball = new THREE.Mesh(marchGeo, m.owner.startsWith("npc:") ? npcMarch : marchMat);
        ball.position.set(p.x * TILE, heightOf(p.x, p.y) + 1.2, p.y * TILE);
        actors.add(ball);
      }
    }

    function frame() {
      const { view, selected, now } = latest.current;
      if (dirty) {
        syncTiles();
        syncCities();
        dirty = false;
      }
      syncActors(now);
      if (selected) {
        marker.visible = true;
        marker.position.set(selected.x * TILE, heightOf(selected.x, selected.y) + 0.08, selected.y * TILE);
      } else marker.visible = false;
      camera.lookAt(view.x * TILE, 0.4, view.y * TILE);
      renderer.render(scene, camera);
    }

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      frame();
    };
    loop();

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();

    function ndc(ev: { clientX: number; clientY: number }) {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    }

    function onDown(ev: PointerEvent) {
      dragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
    }
    function onMove(ev: PointerEvent) {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      const nx = latest.current.view.x - dx * 0.04;
      const ny = latest.current.view.y - dy * 0.04;
      latest.current.onView(nx, ny);
      latest.current = { ...latest.current, view: { x: nx, y: ny } };
      dirty = true;
    }
    function onUp(ev: PointerEvent) {
      dragging = false;
      ndc(ev);
      ray.setFromCamera(mouse, camera);
      const cityHits = ray.intersectObjects(citiesGroup.children, true);
      if (cityHits[0]) {
        const data = cityHits[0].object.userData;
        if (data.cityId) {
          latest.current.onSelect(data.x, data.y);
          return;
        }
      }
      if (ray.ray.intersectPlane(plane, hit)) {
        const x = Math.round(hit.x / TILE);
        const y = Math.round(hit.z / TILE);
        latest.current.onSelect(x, y);
      }
    }
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      camera.position.y = Math.min(70, Math.max(12, camera.position.y + ev.deltaY * 0.03));
      camera.position.z = Math.min(80, Math.max(10, camera.position.z + ev.deltaY * 0.02));
    }
    function onDbl(ev: MouseEvent) {
      ndc(ev);
      ray.setFromCamera(mouse, camera);
      const cityHits = ray.intersectObjects(citiesGroup.children, true);
      const data = cityHits[0]?.object.userData;
      if (data?.cityId) latest.current.onEnterCity(data.cityId);
    }
    function onResize() {
      const w = host.current?.clientWidth || renderer.domElement.clientWidth;
      const h = host.current?.clientHeight || renderer.domElement.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("dblclick", onDbl);
    window.addEventListener("resize", onResize);

    const syncView = () => {
      dirty = true;
    };
    const iv = setInterval(syncView, 400);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("dblclick", onDbl);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    latest.current = props;
  });

  return <div className="canvas-host" ref={host} title="拖动平移，滚轮远近，双击进城" />;
}

export function tileHint(x: number, y: number) {
  return npcAt(x, y) || { name: cityIdAt(x, y), level: 0 };
}
