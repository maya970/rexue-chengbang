import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, ROLES } from "../engine/catalog";
import type { BuildingId, Card, City, World } from "../types";

export function CityCanvas(props: {
  city: City;
  world: World;
  now: number;
  onBuilding: (id: BuildingId) => void;
  onCard: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1812);
    scene.fog = new THREE.Fog(0x1c1812, 28, 90);

    const camera = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.1, 200);
    let yaw = 0.55;
    let pitch = 0.42;
    const orbit = 18;

    scene.add(new THREE.HemisphereLight(0xffe8cc, 0x3a2a1c, 1.15));
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.05);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x6a5844, 0.65));
    const torch = new THREE.PointLight(0xffaa66, 2.6, 22);
    torch.position.set(0, 3.6, 0);
    scene.add(torch);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(18, 56),
      new THREE.MeshStandardMaterial({ color: 0x8f7d5c, roughness: 0.88 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(5.7, 48),
      new THREE.MeshStandardMaterial({ color: 0xe4d4b6, roughness: 0.5 }),
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.03;
    scene.add(plaza);

    const colGeo = new THREE.CylinderGeometry(0.18, 0.22, 3.4, 12);
    const marble = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.35 });
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const col = new THREE.Mesh(colGeo, marble);
      col.position.set(Math.cos(a) * 5.3, 1.7, Math.sin(a) * 5.3);
      col.castShadow = true;
      scene.add(col);
    }

    const bGroup = new THREE.Group();
    scene.add(bGroup);
    const pGroup = new THREE.Group();
    scene.add(pGroup);
    const people = new Map<string, THREE.Group>();

    const hall = new THREE.BoxGeometry(2.2, 1.8, 2.2);
    const roof = new THREE.ConeGeometry(1.7, 1.1, 4);

    function layoutBuildings() {
      bGroup.clear();
      const { city } = latest.current;
      const ids = (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => (city.buildings[id]?.level || 0) > 0);
      ids.forEach((id, i) => {
        const a = (i / Math.max(1, ids.length)) * Math.PI * 2;
        const g = new THREE.Group();
        const lv = city.buildings[id]!.level;
        g.position.set(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6);
        const body = new THREE.Mesh(hall, new THREE.MeshStandardMaterial({ color: id === "harbor" ? 0x4a6d7a : 0xe8d6b2 }));
        body.position.y = 0.9 + lv * 0.08;
        body.scale.y = 1 + lv * 0.12;
        body.userData = { building: id };
        body.castShadow = true;
        const top = new THREE.Mesh(roof, new THREE.MeshStandardMaterial({ color: 0x8a3e34 }));
        top.position.y = 2.1 + lv * 0.12;
        top.rotation.y = Math.PI / 4;
        top.userData = { building: id };
        g.add(body, top);
        bGroup.add(g);
      });
    }

    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.55, 4, 8);
    const headGeo = new THREE.SphereGeometry(0.16, 10, 10);
    const crateGeo = new THREE.BoxGeometry(0.45, 0.32, 0.45);

    function layoutPeople(t: number) {
      const { city, world } = latest.current;
      const cards = Object.values(world.cards).filter((c) => c.cityId === city.id && !c.marchId && c.kind !== "ship");
      const seen = new Set<string>();
      cards.forEach((card: Card, i: number) => {
        seen.add(card.id);
        let g = people.get(card.id);
        if (!g) {
          g = new THREE.Group();
          if (card.kind === "supply") {
            const crate = new THREE.Mesh(crateGeo, new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.6 }));
            crate.userData = { cardId: card.id };
            g.add(crate);
          } else {
            const tint = card.kind === "slave" ? 0x9a7a4a : card.campaigns.length > 4 ? 0xb8863d : 0xd8c4a0;
            const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 }));
            const head = new THREE.Mesh(headGeo, new THREE.MeshStandardMaterial({ color: 0xf0d0b0 }));
            head.position.y = 0.62;
            body.userData = { cardId: card.id };
            head.userData = { cardId: card.id };
            g.add(body, head);
          }
          people.set(card.id, g);
          pGroup.add(g);
        }
        const a = (i / Math.max(1, cards.length)) * Math.PI * 2 + t * 0.00018;
        const r = card.kind === "supply" ? 3.4 + (i % 4) * 0.25 : 1.7 + (i % 5) * 0.42;
        g.position.set(Math.cos(a) * r, card.kind === "supply" ? 0.2 : 0.55, Math.sin(a) * r);
        g.rotation.y = a + Math.PI / 2;
      });
      for (const [id, g] of people) {
        if (seen.has(id)) continue;
        pGroup.remove(g);
        people.delete(id);
      }
    }

    function placeCamera() {
      camera.position.set(Math.cos(yaw) * orbit * Math.cos(pitch), 4 + Math.sin(pitch) * orbit, Math.sin(yaw) * orbit * Math.cos(pitch));
      camera.lookAt(0, 1.15, 0);
    }

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      yaw += 0.0012;
      layoutPeople(latest.current.now);
      placeCamera();
      renderer.render(scene, camera);
    };
    layoutBuildings();
    loop();

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let moved = 0;

    function pick(ev: PointerEvent) {
      if (moved > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects([...bGroup.children, ...pGroup.children], true);
      const data = hits[0]?.object.userData || {};
      if (data.building) latest.current.onBuilding(data.building);
      if (data.cardId) latest.current.onCard(data.cardId);
    }
    function onDown(ev: PointerEvent) {
      dragging = true;
      moved = 0;
      lastX = ev.clientX;
      lastY = ev.clientY;
    }
    function onMove(ev: PointerEvent) {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      lastX = ev.clientX;
      lastY = ev.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      yaw -= dx * 0.008;
      pitch = Math.max(0.12, Math.min(1.1, pitch + dy * 0.006));
    }
    function onUp(ev: PointerEvent) {
      dragging = false;
      pick(ev);
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
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [props.city.id]);

  useEffect(() => {
    latest.current = props;
  });

  return (
    <div className="canvas-host city-canvas" ref={host}>
      <div className="city-caption">
        {props.city.name} · 拖转视角，点建筑或人物打开窗口 · {Object.values(props.world.cards).filter((c) => c.cityId === props.city.id && !c.marchId).length} 人在场
        {" · "}
        {BUILDINGS.acropolis.name}
        {" / "}
        {ROLES.hoplite.name}
      </div>
    </div>
  );
}
