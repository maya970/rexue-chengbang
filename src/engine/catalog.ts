import type { BuildingId, PlotKind, RoleId } from "../types";

export const APP_NAME = "Rexue-Chengbang";
export const APP_TITLE = "热血城邦";
export const PROTOCOL = "Permabin";
export const COLLECTION = "command-batches";
export const WORLD_SEED = 356;
/** 人物卡成交手续费 10% 打到此地址，不是销毁。 */
export const AR_FEE_ADDR = "B1E8CDbmVVLuYHXiheFXbW4E0F1gpGBhpIWTOi2AFi0";
export const MARKET_FEE = 0.1;
export const SUPPLY_PER_SLAVE = 2;
/** 不花物资/奴隶时的工期倍数。 */
export const BARE_BUILD_MULT = 4;

export const COLONIZE_COST = { persons: 3, slaves: 2, supplies: 2 };
export { SETTLE_COST } from "./hamlets";

export const CITY_W = 12;
export const CITY_H = 10;

export const PLOT_NAME: Record<PlotKind, string> = {
  plaza: "广场空地",
  housing: "民宅空地",
  camp: "校场空地",
  grove: "林地空地",
  quarry: "石场空地",
  harbor: "港湾空地",
  yard: "工坊空地",
};

/** 空地外形相同，种类用连通高度区分。 */
export const PLOT_ELEV: Record<PlotKind, number> = {
  harbor: 0,
  housing: 1,
  yard: 1,
  plaza: 2,
  camp: 2,
  grove: 3,
  quarry: 4,
};

/** 空地种类决定建造时间系数。 */
export const PLOT_TIME: Record<PlotKind, number> = {
  plaza: 0.82,
  housing: 0.92,
  camp: 1,
  grove: 1.12,
  quarry: 1.22,
  harbor: 1.08,
  yard: 0.96,
};

export const BUILDING_PLOTS: Record<BuildingId, PlotKind[]> = {
  acropolis: ["plaza", "quarry"],
  agora: ["plaza", "yard"],
  oikos: ["housing"],
  barracks: ["camp"],
  stables: ["camp", "housing"],
  range: ["camp", "grove"],
  wall: ["quarry"],
  temple: ["grove", "plaza"],
  shipyard: ["harbor", "yard"],
  harbor: ["harbor"],
};

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
  acropolis: { name: "卫城", blurb: "可建多座。其他建筑单座等级不能超过最高卫城。各级效果合计。升级工期暴增。有物资或奴隶则更快，没有也能建。", max: 16, baseTime: 48, citizens: 4, recruit: 2, works: 3 },
  agora: { name: "市政广场", blurb: "可建多座。合计每级缩短建造 2%；每 4 级多允许一座同时在建。升级极慢。", max: 16, baseTime: 36, citizens: 2, recruit: 0, works: 2 },
  oikos: { name: "民居", blurb: "可建多座。合计提供公民卡上限。升级工期暴增。", max: 20, baseTime: 16, citizens: 8, recruit: 0, works: 1 },
  barracks: { name: "兵营", blurb: "可建多座。合计提高重装、轻盾、海军陆战上限。多修比升级划算。", max: 16, baseTime: 28, citizens: 1, recruit: 3, works: 2 },
  stables: { name: "马厩", blurb: "可建多座。合计提高骑兵上限。", max: 16, baseTime: 32, citizens: 1, recruit: 2, works: 2 },
  range: { name: "弓营", blurb: "可建多座。合计提高弓手上限。弓手站第二排放箭，但更脆弱。", max: 16, baseTime: 28, citizens: 1, recruit: 2, works: 2 },
  wall: { name: "城墙", blurb: "可建多座，单座最高 3 级。每级只加守方宽度。山地石场多，适合多修墙。升级极慢。", max: 3, baseTime: 36, citizens: 0, recruit: 0, works: 2 },
  temple: { name: "神庙", blurb: "可建多座。合计使守军更难崩溃，战役铭记按合计等级加倍。", max: 12, baseTime: 34, citizens: 1, recruit: 0, works: 2 },
  shipyard: { name: "造船厂", blurb: "可建多座。合计招募舰长、三列桨座、运输船。海岸或海域城才能建。", max: 16, baseTime: 40, citizens: 1, recruit: 2, works: 2, needCoast: true },
  harbor: { name: "海港", blurb: "可建多座。至少一座才能出海；合计等级加快海路。海岸或海域城才能建。", max: 12, baseTime: 32, citizens: 2, recruit: 0, works: 2, needCoast: true },
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
    /** 对应建筑每级可养的本职卡上限。 */
    capPerLevel?: number;
    fragile?: boolean;
    rearFire?: boolean;
  }
> = {
  hoplite: { name: "重装步兵", kind: "person", blurb: "前线宽度内出手。兵营等级决定人数上限。", time: 16, berth: 1, speed: 8, building: "barracks", capPerLevel: 5 },
  peltast: { name: "轻盾兵", kind: "person", blurb: "行军略快。兵营等级决定人数上限。", time: 12, berth: 1, speed: 12, building: "barracks", capPerLevel: 5 },
  toxotes: { name: "弓手", kind: "person", blurb: "站第二排，按地形宽度放箭，但更脆弱。弓营等级决定上限。", time: 14, berth: 1, speed: 10, building: "range", capPerLevel: 4, fragile: true, rearFire: true },
  hippeus: { name: "骑兵", kind: "person", blurb: "陆上最快。马厩等级决定人数上限。", time: 20, berth: 2, speed: 18, building: "stables", capPerLevel: 3 },
  epibatai: { name: "海军陆战", kind: "person", blurb: "登陆与跳帮。兵营等级决定上限。", time: 18, berth: 1, speed: 9, building: "barracks", capPerLevel: 4 },
  trierarch: { name: "舰长", kind: "person", blurb: "战船护航需要舰长。造船厂等级决定上限。", time: 22, berth: 1, speed: 9, building: "shipyard", needCoast: true, capPerLevel: 2 },
  citizen: { name: "公民", kind: "person", blurb: "由奴隶转正。民居等级决定公民上限。", time: 14, berth: 1, speed: 8, building: "oikos", capPerLevel: 6 },
  slave: { name: "奴隶", kind: "slave", blurb: "不能招募。只能战斗抓获，或用本城物资卡买。可转公民、可上阵。", time: 10, berth: 1, speed: 7 },
  supply: { name: "物资", kind: "supply", blurb: "劫掠与屠城获得。本城买奴隶，也可折成建造材料。", time: 0, berth: 0, speed: 0 },
  trireme: { name: "三列桨座", kind: "ship", blurb: "海战与护航。造船厂等级决定舰只上限。", time: 36, berth: 4, speed: 16, building: "shipyard", needCoast: true, capPerLevel: 2 },
  transport: { name: "运输船", kind: "ship", blurb: "载人过海。船没则人没。造船厂等级决定上限。", time: 24, berth: 8, speed: 12, building: "shipyard", needCoast: true, capPerLevel: 3 },
};

export const MISSION_NAME: Record<import("../types").MarchMission, string> = {
  plunder: "劫掠",
  massacre: "屠城",
  destroy: "毁灭",
  occupy: "占领",
  reinforce: "增援",
  colonize: "开辟独立城邦",
  scout: "侦察（抢格）",
  settle: "修建附属乡村",
};

export function scaleTime(base: number, level: number, speed = 1): number {
  return Math.max(10, Math.floor(base * Math.pow(5, Math.max(0, level - 1)) * speed));
}
