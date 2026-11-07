import type { BattleReport, BattleRound, Campaign, Card } from "../types";
import { bitStream } from "./bits";
import { avgCampaigns, cardLine } from "./cards";
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
  /** 神庙：守军士气更难崩溃。 */
  defHold?: number;
}

export interface FightResult {
  report: BattleReport;
  dead: Card[];
}

function volley(
  atk: Card[],
  def: Card[],
  width: number,
  bits: ReturnType<typeof bitStream>,
  dead: Card[],
  rounds: BattleRound[],
  title: string,
): void {
  if (!atk.length || !def.length) return;
  const rear = atk.filter((c) => ROLES[c.role]?.rearFire);
  const front = atk.filter((c) => !ROLES[c.role]?.rearFire);
  const strikers = [...front.slice(0, width), ...rear.slice(0, width)];
  const hits: string[] = [];
  for (const striker of strikers) {
    if (!def.length) break;
    const ti = bits.take(8) % def.length;
    const tgt = def[ti];
    const fragile = ROLES[tgt.role]?.fragile ? 1.42 : 1;
    const chance = Math.min(0.96, killChance(striker.campaigns.length, tgt.campaigns.length) * fragile);
    const roll = bits.frac();
    const rearNote = ROLES[striker.role]?.rearFire ? "（第二排放箭）" : "";
    const frailNote = ROLES[tgt.role]?.fragile ? "（弓手更脆弱）" : "";
    if (roll < chance) {
      hits.push(`${striker.name}${rearNote}击杀${tgt.name}${frailNote}（链上骰 ${roll.toFixed(3)} < ${chance.toFixed(3)}）`);
      dead.push(tgt);
      def.splice(ti, 1);
    } else {
      hits.push(`${striker.name}${rearNote}未取${tgt.name}之性命（${roll.toFixed(3)} ≥ ${chance.toFixed(3)}）`);
    }
  }
  rounds.push({
    title,
    text: `地形宽度 ${width}，前线 ${Math.min(width, front.length)}、第二排弓手 ${Math.min(width, rear.length)} 同时出手。${hits.join("；") || "无人出手"}。`,
  });
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
  const war: Campaign = { id: input.id, name: input.warName, time: input.time };
  for (const c of [...input.atkPeople, ...input.defPeople, ...input.atkShips, ...input.defShips]) addWar(c, war);

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
  rounds.push({
    title: "先手",
    text: `用交易熵的第 1 位随机数判定先手：${atkTurn ? "攻方" : "守方"}先手。地形最高宽度 ${width}。攻 ${cardLine(atk)} / 舰 ${cardLine(atkShips)}；守 ${cardLine(def)} / 舰 ${cardLine(defShips)}。士气取在场平均值，战役越多越难崩溃${defHold ? `。神庙使守军士气 +${defHold.toFixed(2)}` : ""}。`,
  });

  if (input.naval) {
    let r = 0;
    while (atkShips.length && defShips.length && r < 40) {
      r += 1;
      if (atkTurn) volley(atkShips, defShips, width, bits, dead, rounds, `海战第${r}轮·攻`);
      else volley(defShips, atkShips, width, bits, dead, rounds, `海战第${r}轮·守`);
      atkShips = stripDead(atkShips, dead);
      defShips = stripDead(defShips, dead);
      if (moraleBroke(input.atkShips.length, atkShips, bits, 0)) {
        collapsed = "atk";
        rounds.push({ title: "舰队溃散", text: "攻方舰队士气崩溃。运输船不保，名簿落海。" });
        dead.push(...atkShips, ...atk);
        atkShips = [];
        atk = [];
        break;
      }
      if (moraleBroke(input.defShips.length, defShips, bits, defHold)) {
        collapsed = "def";
        rounds.push({ title: "港口溃散", text: "守方舰队士气崩溃。" });
        dead.push(...defShips);
        defShips = [];
        break;
      }
      atkTurn = !atkTurn;
    }
    if (!atkShips.length && input.atkPeople.length && collapsed !== "atk") {
      dead.push(...atk);
      atk = [];
      rounds.push({ title: "沉没", text: "没有存活的舰只，登陆部队入海，人死不能复生。" });
    }
  }

  if (atk.length && (def.length || !input.naval || collapsed !== "atk")) {
    let r = 0;
    while (atk.length && def.length && r < 50) {
      r += 1;
      if (atkTurn) volley(atk, def, width, bits, dead, rounds, `陆战第${r}轮·攻`);
      else volley(def, atk, width, bits, dead, rounds, `陆战第${r}轮·守`);
      atk = stripDead(atk, dead);
      def = stripDead(def, dead);
      if (moraleBroke(input.atkPeople.length, atk, bits, 0)) {
        collapsed = "atk";
        rounds.push({ title: "攻方崩溃", text: `平均战役 ${avgCampaigns(atk).toFixed(1)}，仍未能撑住阵列。` });
        break;
      }
      if (moraleBroke(input.defPeople.length, def, bits, defHold)) {
        collapsed = "def";
        rounds.push({ title: "守方崩溃", text: `平均战役 ${avgCampaigns(def).toFixed(1)}，阵列瓦解。` });
        break;
      }
      atkTurn = !atkTurn;
    }
  }

  const atkLeft = stripDead([...input.atkPeople, ...input.atkShips], dead);
  const defLeft = stripDead([...input.defPeople, ...input.defShips], dead);
  const win = atkLeft.length > 0 && (defLeft.length === 0 || collapsed === "def") && collapsed !== "atk";
  const report: BattleReport = {
    id: input.id,
    time: input.time,
    title: input.field ? (win ? "野外奏捷" : "野外受挫") : win ? "攻城奏凯" : "攻城失利",
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
  };
  void atkN0;
  void defN0;
  return { report, dead };
}
