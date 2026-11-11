import type { ReactNode } from "react";
import { BUILDINGS } from "../engine/catalog";
import { hamletOf, isHamlet } from "../engine/hamlets";
import { homeOf } from "../engine/citymath";
import type { BuildingId, City, Command, World } from "../types";

function remain(ms: number, now: number) {
  const s = Math.max(0, Math.ceil((ms - now) / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}时${m % 60}分${s % 60}秒`;
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`;
}

function IconPop() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="10" r="6" fill="#e8c98a" />
      <path d="M6 28c1-8 6-12 10-12s9 4 10 12" fill="#8a3a2a" />
      <path d="M11 16h10l2 12H9z" fill="#c45c3c" />
    </svg>
  );
}
function IconSlave() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="9" r="5.5" fill="#c9b48a" />
      <path d="M7 28c1-9 5-13 9-13s8 4 9 13" fill="#5a4634" />
      <rect x="8" y="14" width="16" height="3" rx="1" fill="#d4b24a" />
      <circle cx="8" cy="15.5" r="2.2" fill="#bfa046" />
      <circle cx="24" cy="15.5" r="2.2" fill="#bfa046" />
    </svg>
  );
}
function IconSupply() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M5 12h22l-2 16H7z" fill="#b6863d" />
      <path d="M5 12l11-8 11 8" fill="#e0c070" />
      <rect x="13" y="16" width="6" height="8" fill="#6b1d2a" />
    </svg>
  );
}
function IconCity() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M6 28V14l10-8 10 8v14" fill="#8a7a62" />
      <path d="M16 6l12 9h-5v13h-14V15H4z" fill="#d8c49a" />
      <rect x="14" y="18" width="4" height="10" fill="#6b1d2a" />
    </svg>
  );
}
function IconShip() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M4 20h24l-4 8H8z" fill="#6a4a28" />
      <path d="M16 4v16" stroke="#efe4c8" strokeWidth="2" />
      <path d="M16 6l10 12H16z" fill="#c45c5c" />
    </svg>
  );
}

function Cell(props: {
  label: string;
  here: number;
  all: number;
  hint?: string;
  icon: ReactNode;
  tone?: string;
  split?: boolean;
}) {
  return (
    <div className="aoe-cell" title={props.hint || `${props.label} 本城 ${props.here} · 帝国 ${props.all}`}>
      <div className="aoe-icon" style={{ background: props.tone }}>{props.icon}</div>
      <div className="aoe-nums">
        <b>{props.split ? props.here : props.all}</b>
        <em>{props.split ? `帝国 ${props.all}` : "帝国合计"}</em>
        <span>{props.split ? `${props.label}·本城` : props.label}</span>
      </div>
    </div>
  );
}

export function EmpireHud(props: {
  address: string;
  city?: City;
  world: World;
  now: number;
  pending: Command[];
  onOpenCity?: () => void;
}) {
  const { address, city, world, now, pending, onOpenCity } = props;
  const mine = Boolean(city && city.owner === address);
  const cards = Object.values(world.cards).filter((c) => c.owner === address && !world.fallen?.[c.id]);
  const sites = Object.values(world.cities).filter((c) => c.owner === address && !c.npc);
  const cities = sites.filter((c) => !isHamlet(c));
  const hamlets = sites.filter((c) => isHamlet(c));
  const hereId = mine ? city!.id : "";
  const peopleAll = cards.filter((c) => c.kind === "person").length;
  const peopleHere = hereId ? cards.filter((c) => c.kind === "person" && homeOf(c) === hereId).length : 0;
  const slaveAll = cards.filter((c) => c.kind === "slave").length;
  const slaveHere = hereId ? cards.filter((c) => c.kind === "slave" && c.cityId === hereId && !c.marchId).length : 0;
  const goodsAll = cards.filter((c) => c.kind === "supply").length;
  const goodsHere = hereId ? cards.filter((c) => c.kind === "supply" && c.cityId === hereId).length : 0;
  const shipsAll = cards.filter((c) => c.kind === "ship").length;
  const shipsHere = hereId ? cards.filter((c) => c.kind === "ship" && c.cityId === hereId && !c.marchId).length : 0;

  const jobs = sites.flatMap((c) =>
    (Object.entries(c.buildings) as [BuildingId, NonNullable<City["buildings"][BuildingId]>][])
      .filter(([, b]) => b?.job)
      .map(([bid, b]) => ({
        key: `${c.id}:${bid}`,
        name: BUILDINGS[bid].name,
        city: c.name,
        to: b.job!.to,
        finishAt: b.job!.finishAt,
        here: c.id === hereId,
      })),
  ).sort((a, b) => a.finishAt - b.finishAt);
  const queued = pending.filter((c) => c.kind === "upgrade").map((c) => ({
    key: c.id,
    name: c.building ? BUILDINGS[c.building].name : "建筑",
    city: world.cities[c.cityId || ""]?.name || "本城",
    to: 0,
    finishAt: 0,
    here: c.cityId === hereId,
    wait: true,
  }));

  return (
    <div className="aoe-hud">
      <div className="aoe-bar">
        <div className="aoe-place cinzel" role={onOpenCity && mine ? "button" : undefined} onClick={mine ? onOpenCity : undefined}>
          <strong>{mine ? city!.name : "帝国"}</strong>
          <small>
            {mine
              ? `${hamletOf(city!) === "city" ? "本城库存" : "本聚落库存"} · 上排本城 / 下排帝国`
              : "未选自己的城 · 数字为帝国合计"}
          </small>
        </div>
        <Cell split={mine} label="人口" here={peopleHere} all={peopleAll} icon={<IconPop />} tone="#5a2418" hint="人物卡：本城编制 / 帝国拥有" />
        <Cell split={mine} label="奴隶" here={slaveHere} all={slaveAll} icon={<IconSlave />} tone="#3a2a18" hint="奴隶卡：本城驻扎 / 帝国拥有" />
        <Cell split={mine} label="物资" here={goodsHere} all={goodsAll} icon={<IconSupply />} tone="#4a3814" hint="物资卡：本城仓库 / 帝国拥有" />
        <Cell split={mine} label="城邦" here={mine && !isHamlet(city!) ? 1 : 0} all={cities.length} icon={<IconCity />} tone="#2a3038" hint="独立城邦：当前这座是否城邦 / 帝国座数" />
        <Cell split={mine} label="聚落" here={mine && isHamlet(city!) ? 1 : 0} all={hamlets.length} icon={<IconCity />} tone="#243428" hint="乡村郊区城区：当前是否聚落 / 帝国处数" />
        <Cell split={mine} label="舰船" here={shipsHere} all={shipsAll} icon={<IconShip />} tone="#1c3040" hint="舰只：本城停泊 / 帝国拥有" />
      </div>
      {jobs.length || queued.length ? (
        <div className="aoe-queue">
          {jobs.map((j) => (
            <div className={`aoe-job${j.here ? " on" : ""}`} key={j.key}>
              <b>{j.name} →{j.to}级</b>
              <span>{j.city}</span>
              <em>{remain(j.finishAt, now)}</em>
            </div>
          ))}
          {queued.map((j) => (
            <div className={`aoe-job wait${j.here ? " on" : ""}`} key={j.key}>
              <b>{j.name}</b>
              <span>{j.city}</span>
              <em>待执行</em>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
