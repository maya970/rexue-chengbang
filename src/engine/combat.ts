import type { BattleHit, BattleReport, BattleRound, Campaign, Card } from "../types";
import { bitStream } from "./bits";
import { avgCampaigns } from "./cards";

function lineOf(cards: Card[]) {
  if (!cards.length) return "—";
  return cards.map((c) => `${c.name} (${c.campaigns.length})`).join(", ");
}
import { ROLES } from "./catalog";

function killChance(atkCamp: number, defCamp: number): number {
  const raw = 0.5 + (atkCamp - defCamp) * 0.035;
  return Math.min(0.92, Math.max(0.08, raw));
}

function holdLine(avgCamp: number): number {
  return Math.min(0.9, 0.26 + avgCamp * 0.045);
}

function addWar(card: Card, war: Campaign) {
  if (!card.campaigns.some((c) => c.id === war.id)) card.campaigns.push(war);
}

export interface FightInput {
  id: string;
  entropy: string;
  time: number;
  attacker: string;
  defender: string;
  x: number;
  y: number;
  atkPeople: Card[];
  defPeople: Card[];
  atkShips: Card[];
  defShips: Card[];
  frontage: number;
  naval: boolean;
  field: boolean;
  warName: string;
  defHold?: number;
}

export interface FightResult {
  report: BattleReport;
  dead: Card[];
}

function round(key: string, params: BattleRound["params"], title: string, text: string): BattleRound {
  return { key, params, title, text };
}

function volley(
  atk: Card[],
  def: Card[],
  width: number,
  bits: ReturnType<typeof bitStream>,
  dead: Card[],
  rounds: BattleRound[],
  kind: "seaAtk" | "seaDef" | "landAtk" | "landDef",
  n: number,
): void {
  if (!atk.length || !def.length) return;
  const rear = atk.filter((c) => ROLES[c.role]?.rearFire);
  const front = atk.filter((c) => !ROLES[c.role]?.rearFire);
  const strikers = [...front.slice(0, width), ...rear.slice(0, width)];
  const hits: BattleHit[] = [];
  const lines: string[] = [];
  for (const striker of strikers) {
    if (!def.length) break;
    const ti = bits.take(8) % def.length;
    const tgt = def[ti];
    const fragile = ROLES[tgt.role]?.fragile ? 1.42 : 1;
    const chance = Math.min(0.96, killChance(striker.campaigns.length, tgt.campaigns.length) * fragile);
    const roll = bits.frac();
    const hit: BattleHit = {
      kind: roll < chance ? "kill" : "miss",
      striker: striker.name,
      tgt: tgt.name,
      roll: roll.toFixed(3),
      chance: chance.toFixed(3),
      rear: Boolean(ROLES[striker.role]?.rearFire),
      frail: Boolean(ROLES[tgt.role]?.fragile),
    };
    hits.push(hit);
    const rearNote = hit.rear ? "（第二排放箭）" : "";
    const frailNote = hit.frail ? "（弓手更脆弱）" : "";
    if (hit.kind === "kill") {
      lines.push(`${striker.name}${rearNote}击杀${tgt.name}${frailNote}（链上骰 ${hit.roll} < ${hit.chance}）`);
      dead.push(tgt);
      def.splice(ti, 1);
    } else {
      lines.push(`${striker.name}${rearNote}未取${tgt.name}之性命（${hit.roll} ≥ ${hit.chance}）`);
    }
  }
  const frontN = Math.min(width, front.length);
  const rearN = Math.min(width, rear.length);
  rounds.push(round(kind, { n, width, front: frontN, rear: rearN, hits }, `${kind.startsWith("sea") ? "海战" : "陆战"}第${n}轮·${kind.endsWith("Atk") ? "攻" : "守"}`, `地形宽度 ${width}，前线 ${frontN}、第二排弓手 ${rearN} 同时出手。${lines.join("；") || "无人出手"}。`));
}

function moraleBroke(original: number, remain: Card[], bits: ReturnType<typeof bitStream>, extraHold = 0): boolean {
  if (!remain.length) return true;
  if (remain.length === original) return false;
  const loss = 1 - remain.length / Math.max(1, original);
  const hold = Math.min(0.94, holdLine(avgCampaigns(remain)) + extraHold);
  if (loss < hold) return false;
  return bits.bit() === 1;
}

function stripDead(list: Card[], dead: Card[]): Card[] {
  const gone = new Set(dead.map((c) => c.id));
  return list.filter((c) => !gone.has(c.id));
}

export function resolveFight(input: FightInput): FightResult {
  const bits = bitStream(input.entropy + "|" + input.id);
  const rounds: BattleRound[] = [];
  const dead: Card[] = [];
  const atkWar: Campaign = { id: `${input.id}:atk`, name: `进攻·${input.warName}`, time: input.time };
  const defWar: Campaign = { id: `${input.id}:def`, name: `守城·${input.warName}`, time: input.time };
  const fieldWar: Campaign = { id: `${input.id}:field`, name: `野战·${input.warName}`, time: input.time };
  if (input.field) {
    for (const c of [...input.atkPeople, ...input.atkShips, ...input.defPeople, ...input.defShips]) addWar(c, fieldWar);
  } else {
    for (const c of [...input.atkPeople, ...input.atkShips]) addWar(c, atkWar);
    for (const c of [...input.defPeople, ...input.defShips]) addWar(c, defWar);
  }

  let atkShips = [...input.atkShips];
  let defShips = [...input.defShips];
  let atk = [...input.atkPeople];
  let def = [...input.defPeople];
  const atkN0 = atk.length + atkShips.length;
  const defN0 = def.length + defShips.length;
  let collapsed: "atk" | "def" | undefined;
  const width = Math.max(1, input.frontage);
  const defHold = Math.max(0, input.defHold || 0);
  let atkTurn = bits.bit() === 1;
  rounds.push(round("first", {
    side: atkTurn ? "atk" : "def",
    width,
    atk: lineOf(atk),
    atkShips: lineOf(atkShips),
    def: lineOf(def),
    defShips: lineOf(defShips),
    temple: defHold ? defHold.toFixed(2) : "",
  }, "先手", `用交易熵的第 1 位随机数判定先手：${atkTurn ? "攻方" : "守方"}先手。地形最高宽度 ${width}。攻 ${lineOf(atk)} / 舰 ${lineOf(atkShips)}；守 ${lineOf(def)} / 舰 ${lineOf(defShips)}。士气取在场平均值，战役越多越难崩溃${defHold ? `。神庙使守军士气 +${defHold.toFixed(2)}` : ""}。`));

  if (input.naval) {
    let r = 0;
    while (atkShips.length && defShips.length && r < 40) {
      r += 1;
      if (atkTurn) volley(atkShips, defShips, width, bits, dead, rounds, "seaAtk", r);
      else volley(defShips, atkShips, width, bits, dead, rounds, "seaDef", r);
      atkShips = stripDead(atkShips, dead);
      defShips = stripDead(defShips, dead);
      if (moraleBroke(input.atkShips.length, atkShips, bits, 0)) {
        collapsed = "atk";
        rounds.push(round("fleetBreak", {}, "舰队溃散", "攻方舰队士气崩溃。运输船不保，名簿落海。"));
        dead.push(...atkShips, ...atk);
        atkShips = [];
        atk = [];
        break;
      }
      if (moraleBroke(input.defShips.length, defShips, bits, defHold)) {
        collapsed = "def";
        rounds.push(round("portBreak", {}, "港口溃散", "守方舰队士气崩溃。"));
        dead.push(...defShips);
        defShips = [];
        break;
      }
      atkTurn = !atkTurn;
    }
    if (!atkShips.length && input.atkPeople.length && collapsed !== "atk") {
      dead.push(...atk);
      atk = [];
      rounds.push(round("sunk", {}, "沉没", "没有存活的舰只，登陆部队入海，人死不能复生。"));
    }
  }

  if (atk.length && (def.length || !input.naval || collapsed !== "atk")) {
    let r = 0;
    while (atk.length && def.length && r < 50) {
      r += 1;
      if (atkTurn) volley(atk, def, width, bits, dead, rounds, "landAtk", r);
      else volley(def, atk, width, bits, dead, rounds, "landDef", r);
      atk = stripDead(atk, dead);
      def = stripDead(def, dead);
      if (moraleBroke(input.atkPeople.length, atk, bits, 0)) {
        collapsed = "atk";
        const avg = avgCampaigns(atk).toFixed(1);
        rounds.push(round("atkBreak", { avg }, "攻方崩溃", `平均战役 ${avg}，仍未能撑住阵列。`));
        break;
      }
      if (moraleBroke(input.defPeople.length, def, bits, defHold)) {
        collapsed = "def";
        const avg = avgCampaigns(def).toFixed(1);
        rounds.push(round("defBreak", { avg }, "守方崩溃", `平均战役 ${avg}，阵列瓦解。`));
        break;
      }
      atkTurn = !atkTurn;
    }
  }

  const atkLeft = stripDead([...input.atkPeople, ...input.atkShips], dead);
  const defLeft = stripDead([...input.defPeople, ...input.defShips], dead);
  const win = atkLeft.length > 0 && (defLeft.length === 0 || collapsed === "def") && collapsed !== "atk";
  const atkIds = new Set([...input.atkPeople, ...input.atkShips].map((c) => c.id));
  const deadAtk = dead.filter((c) => atkIds.has(c.id));
  const deadDef = dead.filter((c) => !atkIds.has(c.id));
  const code = input.field ? (win ? "fieldWin" : "fieldLose") : win ? "siegeWin" : "siegeLose";
  const report: BattleReport = {
    id: input.id,
    time: input.time,
    title: input.field ? (win ? "野外奏捷" : "野外受挫") : win ? "攻城奏凯" : "攻城失利",
    code,
    attacker: input.attacker,
    defender: input.defender,
    x: input.x,
    y: input.y,
    naval: input.naval,
    field: input.field,
    win,
    collapsed,
    rounds,
    deadNames: [...new Set(dead.map((c) => c.name))],
    deadIds: [...new Set(dead.map((c) => c.id))],
    deadAtkNames: [...new Set(deadAtk.map((c) => c.name))],
    deadDefNames: [...new Set(deadDef.map((c) => c.name))],
  };
  void atkN0;
  void defN0;
  return { report, dead };
}
