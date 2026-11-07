import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, ROLES } from "../engine/catalog";
import type { BuildingId, Card, City, World } from "../types";

const BASE = import.meta.env.BASE_URL;

function house(wall: THREE.Material, roof: THREE.Material, w: number, d: number, h: number) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, h * 0.55, 4), roof);
  top.position.y = h + h * 0.22;
  top.rotation.y = Math.PI / 4;
  top.castShadow = true;
  g.add(body, top);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h * 0.28, 0.06), new THREE.MeshStandardMaterial({ color: 0x1c1410 }));
  sill.position.set(0, h * 0.55, d / 2 + 0.04);
  g.add(sill);
  return g;
}

function tree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
  trunk.position.y = 0.35;
  const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x3f7a3a, flatShading: true }));
  leaf.position.y = 1.05;
  g.add(trunk, leaf);
  return g;
}

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
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87a07a);
    scene.fog = new THREE.Fog(0x87a07a, 28, 55);

    const aspect = el.clientWidth / Math.max(1, el.clientHeight);
    const view = 11;
    const camera = new THREE.OrthographicCamera(-view * aspect, view * aspect, view, -view, 0.1, 80);
    camera.position.set(16, 18, 16);
    camera.lookAt(0, 0.4, 0);

    scene.add(new THREE.HemisphereLight(0xfff0d8, 0x3a4a30, 1.05));
    const sun = new THREE.DirectionalLight(0xffe6c0, 1.8);
    sun.position.set(12, 20, 8);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const loader = new THREE.TextureLoader();
    const cobble = loader.load(`${BASE}city/cobble.jpg`);
    const grass = loader.load(`${BASE}city/grass.jpg`);
    const wallTex = loader.load(`${BASE}city/wall.jpg`);
    const roofTex = loader.load(`${BASE}city/roof.jpg`);
    [cobble, grass, wallTex, roofTex].forEach((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
    });
    cobble.repeat.set(8, 8);
    grass.repeat.set(10, 10);
    wallTex.repeat.set(2, 2);
    roofTex.repeat.set(2, 2);

    const grassMat = new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 });
    const cobbleMat = new THREE.MeshStandardMaterial({ map: cobble, roughness: 0.82 });
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.65 });

    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), grassMat);
    lawn.rotation.x = -Math.PI / 2;
    lawn.receiveShadow = true;
    scene.add(lawn);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), cobbleMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.02;
    plaza.receiveShadow = true;
    scene.add(plaza);

    const roadH = new THREE.Mesh(new THREE.PlaneGeometry(36, 2.2), cobbleMat);
    roadH.rotation.x = -Math.PI / 2;
    roadH.position.y = 0.015;
    const roadV = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 36), cobbleMat);
    roadV.rotation.x = -Math.PI / 2;
    roadV.position.y = 0.015;
    scene.add(roadH, roadV);

    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0xcfc4b0 }));
    fountain.position.y = 0.2;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16), new THREE.MeshStandardMaterial({ color: 0x4aa0c8, roughness: 0.2, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.39;
    scene.add(fountain, water);

    const colGeo = new THREE.CylinderGeometry(0.14, 0.16, 2.6, 10);
    const marble = new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.35 });
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(colGeo, marble);
      col.position.set(Math.cos(a) * 4.4, 1.3, Math.sin(a) * 4.4);
      col.castShadow = true;
      scene.add(col);
    }

    for (let i = 0; i < 10; i += 1) {
      const tr = tree();
      const a = (i / 10) * Math.PI * 2 + 0.2;
      tr.position.set(Math.cos(a) * 11.5, 0, Math.sin(a) * 11.5);
      scene.add(tr);
    }

    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffcc77, emissive: 0x553300 });
    for (const p of [[5.2, 5.2], [-5.2, 5.2], [5.2, -5.2], [-5.2, -5.2]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a18 }));
      pole.position.set(p[0], 0.8, p[1]);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), lampMat);
      lamp.position.set(p[0], 1.65, p[1]);
      scene.add(pole, lamp);
    }

    const bGroup = new THREE.Group();
    scene.add(bGroup);
    const pGroup = new THREE.Group();
    scene.add(pGroup);
    const people = new Map<string, THREE.Sprite>();

    function layoutBuildings() {
      bGroup.clear();
      const { city } = latest.current;
      const ids = (Object.keys(BUILDINGS) as BuildingId[]).filter((id) => (city.buildings[id]?.level || 0) > 0);
      const slots: [number, number][] = [
        [0, -8.2], [7.4, -7.2], [-7.4, -7.2], [8.2, 0], [-8.2, 0], [7.2, 7.2], [-7.2, 7.2], [0, 8.4], [4.6, 8.2], [-4.6, 8.2],
      ];
      ids.forEach((id, i) => {
        const lv = city.buildings[id]!.level;
        const h = house(wallMat, roofMat, 2.4 + lv * 0.08, 2.1, 1.5 + lv * 0.12);
        const slot = slots[i % slots.length];
        h.position.set(slot[0], 0, slot[1]);
        h.traverse((o) => {
          o.userData = { building: id };
        });
        bGroup.add(h);
      });
    }

    const maps: Record<string, THREE.Texture> = {
      person: loader.load(`${BASE}city/citizen.jpg`),
      slave: loader.load(`${BASE}city/slave.jpg`),
      hoplite: loader.load(`${BASE}city/hoplite.jpg`),
    };
    Object.values(maps).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
    });

    function spriteFor(card: Card) {
      const tex = card.kind === "slave" ? maps.slave : card.role === "hoplite" ? maps.hoplite : maps.person;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: false });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(1.15, 1.45, 1);
      spr.userData = { cardId: card.id };
      return spr;
    }

    function layoutPeople(t: number) {
      const { city, world } = latest.current;
      const cards = Object.values(world.cards).filter((c) => c.cityId === city.id && !c.marchId && (c.kind === "person" || c.kind === "slave"));
      const seen = new Set<string>();
      cards.forEach((card, i) => {
        seen.add(card.id);
        let spr = people.get(card.id);
        if (!spr) {
          spr = spriteFor(card);
          people.set(card.id, spr);
          pGroup.add(spr);
        }
        const a = (i / Math.max(1, cards.length)) * Math.PI * 2 + t * 0.00012;
        const r = 2.2 + (i % 4) * 0.45;
        spr.position.set(Math.cos(a) * r, 0.75, Math.sin(a) * r);
      });
      for (const [id, spr] of people) {
        if (seen.has(id)) continue;
        pGroup.remove(spr);
        people.delete(id);
      }
    }

    layoutBuildings();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      layoutPeople(latest.current.now);
      renderer.render(scene, camera);
    };
    loop();

    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    function pick(ev: PointerEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects([...bGroup.children, ...pGroup.children], true);
      const data = hits[0]?.object.userData || {};
      if (data.building) latest.current.onBuilding(data.building);
      if (data.cardId) latest.current.onCard(data.cardId);
    }
    function onResize() {
      const w = host.current?.clientWidth || renderer.domElement.clientWidth;
      const h = host.current?.clientHeight || renderer.domElement.clientHeight;
      renderer.setSize(w, h);
      const a = w / Math.max(1, h);
      camera.left = -view * a;
      camera.right = view * a;
      camera.updateProjectionMatrix();
    }
    renderer.domElement.addEventListener("pointerdown", pick);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener("pointerdown", pick);
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
        {props.city.name} · 锁定四分之三俯视 · 点建筑或人物打开窗口 · {Object.values(props.world.cards).filter((c) => c.cityId === props.city.id && !c.marchId).length} 人在场
        {" · "}
        {BUILDINGS.acropolis.name}/{ROLES.hoplite.name}
      </div>
    </div>
  );
}
