import type { BuildingId, RoleId } from "../types";

export const APP_NAME = "Rexue-Chengbang";
export const APP_TITLE = "热血城邦";
export const PROTOCOL = "Permabin";
export const COLLECTION = "command-batches";
export const WORLD_SEED = 356;
/** 人物卡成交手续费 10% 打到此地址，不是销毁。 */
export const AR_FEE_ADDR = "B1E8CDbmVVLuYHXiheFXbW4E0F1gpGBhpIWTOi2AFi0";
export const MARKET_FEE = 0.1;
export const SUPPLY_PER_SLAVE = 2;

export const COLONIZE_COST = { persons: 3, slaves: 2, supplies: 2 };

export function splitWinston(winston: number): { pay: number; burn: number } {
  const burn = Math.max(1, Math.floor(winston * MARKET_FEE));
  const pay = Math.max(1, winston - burn);
  return { pay, burn };
}

export const BUILDINGS: Record<
  BuildingId,
  {
    name: string;
    blurb: string;
    max: number;
    baseTime: number;
    citizens: number;
    recruit: number;
    works: number;
    needCoast?: boolean;
  }
> = {
  acropolis: { name: "卫城", blurb: "城邦心脏。等级上限、名额与成果。", max: 16, baseTime: 48, citizens: 4, recruit: 2, works: 3 },
  agora: { name: "市政广场", blurb: "缩短建筑与招募时间。", max: 16, baseTime: 36, citizens: 2, recruit: 0, works: 2 },
  oikos: { name: "民居", blurb: "公民主要来源。", max: 20, baseTime: 16, citizens: 8, recruit: 0, works: 1 },
  barracks: { name: "兵营", blurb: "招募步兵、轻盾、海军陆战。", max: 16, baseTime: 28, citizens: 1, recruit: 3, works: 2 },
  stables: { name: "马厩", blurb: "招募骑兵。", max: 16, baseTime: 32, citizens: 1, recruit: 2, works: 2 },
  range: { name: "弓营", blurb: "招募弓手。", max: 16, baseTime: 28, citizens: 1, recruit: 2, works: 2 },
  wall: { name: "城墙", blurb: "守城时略增地形宽度。", max: 16, baseTime: 30, citizens: 0, recruit: 0, works: 2 },
  temple: { name: "神庙", blurb: "铭记战争。每场战役都刻在墙上。", max: 12, baseTime: 34, citizens: 1, recruit: 0, works: 2 },
  shipyard: { name: "造船厂", blurb: "建造舰只。必须沿海。", max: 16, baseTime: 40, citizens: 1, recruit: 2, works: 2, needCoast: true },
  harbor: { name: "海港", blurb: "没有港口不能出海。必须沿海。", max: 12, baseTime: 32, citizens: 2, recruit: 0, works: 2, needCoast: true },
};

export const ROLES: Record<
  RoleId,
  {
    name: string;
    kind: "person" | "slave" | "ship" | "supply";
    blurb: string;
    time: number;
    berth: number;
    speed: number;
    building?: BuildingId;
    needCoast?: boolean;
  }
> = {
  hoplite: { name: "重装步兵", kind: "person", blurb: "没有基础属性。战役越多越强，仍可能死。", time: 16, berth: 1, speed: 8, building: "barracks" },
  peltast: { name: "轻盾兵", kind: "person", blurb: "行军略快，战斗只看战役履历。", time: 12, berth: 1, speed: 12, building: "barracks" },
  toxotes: { name: "弓手", kind: "person", blurb: "从弓营招募。", time: 14, berth: 1, speed: 10, building: "range" },
  hippeus: { name: "骑兵", kind: "person", blurb: "陆上最快。", time: 20, berth: 2, speed: 18, building: "stables" },
  epibatai: { name: "海军陆战", kind: "person", blurb: "登陆与跳帮。", time: 18, berth: 1, speed: 9, building: "barracks", needCoast: true },
  trierarch: { name: "舰长", kind: "person", blurb: "战船护航需要舰长。", time: 22, berth: 1, speed: 9, building: "shipyard", needCoast: true },
  citizen: { name: "公民", kind: "person", blurb: "由奴隶转正。占招募名额，可监工、可上阵。", time: 14, berth: 1, speed: 8, building: "oikos" },
  slave: { name: "奴隶", kind: "slave", blurb: "不能招募。只能战斗抓获，或用本城物资卡买。可转公民、可上阵。", time: 10, berth: 1, speed: 7 },
  supply: { name: "物资", kind: "supply", blurb: "劫掠与屠城获得。本城买奴隶，也可折成建造材料。", time: 0, berth: 0, speed: 0 },
  trireme: { name: "三列桨座", kind: "ship", blurb: "海战与护航。", time: 36, berth: 4, speed: 16, building: "shipyard", needCoast: true },
  transport: { name: "运输船", kind: "ship", blurb: "载人过海。船没则人没。", time: 24, berth: 8, speed: 12, building: "shipyard", needCoast: true },
};

export const MISSION_NAME: Record<import("../types").MarchMission, string> = {
  plunder: "劫掠",
  massacre: "屠城",
  destroy: "毁灭",
  reinforce: "增援",
  colonize: "开辟殖民市",
  scout: "侦察",
};

export function scaleTime(base: number, level: number, speed = 1): number {
  return Math.max(10, Math.floor(base * Math.pow(1.32, Math.max(0, level - 1)) * speed));
}
