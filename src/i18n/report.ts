import type { BattleHit, BattleReport, BattleRound, MarchMission } from "../types";
import type { LocaleId } from "./locales";

type ReportDict = Record<string, string>;

function fill(tpl: string, params: Record<string, string | number | boolean | undefined> = {}) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

const zhCN: ReportDict = {
  win: "成", lose: "败",
  fieldWin: "野外奏捷", fieldLose: "野外受挫", siegeWin: "攻城奏凯", siegeLose: "攻城失利",
  scout: "侦察回报", reinforceOk: "增援抵达", reinforceBack: "增援折返",
  colonizeFail: "殖民失败", colonizeOk: "殖民成功", empty: "{mission}无果", home: "军团入城",
  noSelf: "不能攻击自己", noGuild: "不能攻击公会",
  noSelfText: "不能攻击自己的城，军团已返回。", noGuildText: "不能攻击同公会成员，军团已返回。",
  first: "先手",
  firstText: "用交易熵的第 1 位随机数判定先手：{side}先手。地形最高宽度 {width}。攻 {atk} / 舰 {atkShips}；守 {def} / 舰 {defShips}。士气取在场平均值，战役越多越难崩溃{templeNote}。",
  atk: "攻方", def: "守方",
  templeNote: "。神庙使守军士气 +{temple}",
  seaAtk: "海战第{n}轮·攻", seaDef: "海战第{n}轮·守", landAtk: "陆战第{n}轮·攻", landDef: "陆战第{n}轮·守",
  volley: "地形宽度 {width}，前线 {front}、第二排弓手 {rear} 同时出手。{hits}",
  nobody: "无人出手",
  kill: "{striker}{rear}击杀{tgt}{frail}（链上骰 {roll} < {chance}）",
  miss: "{striker}{rear}未取{tgt}之性命（{roll} ≥ {chance}）",
  rear: "（第二排放箭）", frail: "（弓手更脆弱）",
  fleetBreak: "舰队溃散", fleetBreakText: "攻方舰队士气崩溃。运输船不保，名簿落海。",
  portBreak: "港口溃散", portBreakText: "守方舰队士气崩溃。",
  sunk: "沉没", sunkText: "没有存活的舰只，登陆部队入海，人死不能复生。",
  atkBreak: "攻方崩溃", atkBreakText: "平均战役 {avg}，仍未能撑住阵列。",
  defBreak: "守方崩溃", defBreakText: "平均战役 {avg}，阵列瓦解。",
  plunder: "劫掠", plunderText: "带走奴隶卡 {slaves}、物资卡 {supplies}。因兵民悬殊，只毁去 {hurt} 级建筑。城未易主。",
  occupy: "占领", occupyText: "{name} 易主。系统城不能毁灭，可占领、劫掠、屠城。",
  massacre: "屠城", massacreText: "城易主。毁建筑 {hurt} 级，得奴隶卡 {slaves}、物资卡 {supplies}。兵少则毁不了太多。",
  noDestroy: "不能毁灭", noDestroyText: "{name} 是系统城，已改为占领。",
  destroy: "毁灭", destroyText: "{name} 从地图上抹去。奴隶卡 {slaves}、物资卡 {supplies} 带回。",
  scoutPeek: "斥候",
  scoutCity: "城墙履历 {wars} 场。公民约 {cit}，名册 {people}，舰只 {ships}，宽度 {width}。",
  scoutOpen: "目标地无城。连通已打通，可开辟殖民市。",
  scoutBlocked: "目标地无城。第二座城必须先把连通格子打下来。",
  letter: "回报",
  reinforceIn: "{n} 人进入 {name}。",
  reinforceReturn: "目标不是自己的城，军团已返回出发城。",
  colonizeFailText: "此地不能建城，军团已返回出发城。",
  colonizeOpen: "开辟",
  colonizeText: "{name} 建立。消耗奴隶 {slaves}、物资 {supplies}，人物卡迁入新城。",
  emptyText: "目标格没有城。{n} 人已返回出发城。",
  homeText: "{n} 人进入自己的 {name}。",
  loseReturn: "失利，幸存者已返回出发城。",
  loot: "缴获奴隶 {slaves} · 物资 {supplies}",
  dead: "阵亡：{names}",
  wild: "荒野", enroute: "途中",
  toast: "军团回报", toastOk: "成功", toastBad: "失败",
  mission_plunder: "劫掠", mission_massacre: "屠城", mission_destroy: "毁灭", mission_occupy: "占领",
  mission_reinforce: "增援", mission_colonize: "开辟殖民市", mission_scout: "侦察",
};

const zhTW: ReportDict = {
  ...zhCN,
  win: "成", lose: "敗",
  fieldWin: "野外奏捷", fieldLose: "野外受挫", siegeWin: "攻城奏凱", siegeLose: "攻城失利",
  scout: "偵察回報", reinforceOk: "增援抵達", reinforceBack: "增援折返",
  colonizeFail: "殖民失敗", colonizeOk: "殖民成功", empty: "{mission}無果", home: "軍團入城",
  noSelf: "不能攻擊自己", noGuild: "不能攻擊公會",
  noSelfText: "不能攻擊自己的城，軍團已返回。", noGuildText: "不能攻擊同公會成員，軍團已返回。",
  first: "先手", firstText: "用交易熵的第 1 位亂數判定先手：{side}先手。地形最高寬度 {width}。攻 {atk} / 艦 {atkShips}；守 {def} / 艦 {defShips}。士氣取在場平均值，戰役越多越難崩潰{templeNote}。",
  atk: "攻方", def: "守方", templeNote: "。神廟使守軍士氣 +{temple}",
  seaAtk: "海戰第{n}輪·攻", seaDef: "海戰第{n}輪·守", landAtk: "陸戰第{n}輪·攻", landDef: "陸戰第{n}輪·守",
  volley: "地形寬度 {width}，前線 {front}、第二排弓手 {rear} 同時出手。{hits}",
  nobody: "無人出手",
  kill: "{striker}{rear}擊殺{tgt}{frail}（鏈上骰 {roll} < {chance}）",
  miss: "{striker}{rear}未取{tgt}之性命（{roll} ≥ {chance}）",
  rear: "（第二排放箭）", frail: "（弓手更脆弱）",
  fleetBreak: "艦隊潰散", fleetBreakText: "攻方艦隊士氣崩潰。運輸船不保，名簿落海。",
  portBreak: "港口潰散", portBreakText: "守方艦隊士氣崩潰。",
  sunk: "沉沒", sunkText: "沒有存活的艦隻，登陸部隊入海，人死不能復生。",
  atkBreak: "攻方崩潰", atkBreakText: "平均戰役 {avg}，仍未能撐住陣列。",
  defBreak: "守方崩潰", defBreakText: "平均戰役 {avg}，陣列瓦解。",
  plunder: "劫掠", plunderText: "帶走奴隸卡 {slaves}、物資卡 {supplies}。因兵民懸殊，只毀去 {hurt} 級建築。城未易主。",
  occupy: "佔領", occupyText: "{name} 易主。系統城不能毀滅，可佔領、劫掠、屠城。",
  massacre: "屠城", massacreText: "城易主。毀建築 {hurt} 級，得奴隸卡 {slaves}、物資卡 {supplies}。兵少則毀不了太多。",
  noDestroy: "不能毀滅", noDestroyText: "{name} 是系統城，已改為佔領。",
  destroy: "毀滅", destroyText: "{name} 從地圖上抹去。奴隸卡 {slaves}、物資卡 {supplies} 帶回。",
  scoutPeek: "斥候",
  scoutCity: "城牆履歷 {wars} 場。公民約 {cit}，名冊 {people}，艦隻 {ships}，寬度 {width}。",
  scoutOpen: "目標地無城。連通已打通，可開闢殖民市。",
  scoutBlocked: "目標地無城。第二座城必須先把連通格子打下來。",
  letter: "回報",
  reinforceIn: "{n} 人進入 {name}。",
  reinforceReturn: "目標不是自己的城，軍團已返回出發城。",
  colonizeFailText: "此地不能建城，軍團已返回出發城。",
  colonizeOpen: "開闢",
  colonizeText: "{name} 建立。消耗奴隸 {slaves}、物資 {supplies}，人物卡遷入新城。",
  emptyText: "目標格沒有城。{n} 人已返回出發城。",
  homeText: "{n} 人進入自己的 {name}。",
  loseReturn: "失利，倖存者已返回出發城。",
  loot: "繳獲奴隸 {slaves} · 物資 {supplies}",
  dead: "陣亡：{names}",
  wild: "荒野", enroute: "途中",
  toast: "軍團回報", toastOk: "成功", toastBad: "失敗",
  mission_plunder: "劫掠", mission_massacre: "屠城", mission_destroy: "毀滅", mission_occupy: "佔領",
  mission_reinforce: "增援", mission_colonize: "開闢殖民市", mission_scout: "偵察",
};

const en: ReportDict = {
  win: "W", lose: "L",
  fieldWin: "Field victory", fieldLose: "Field setback", siegeWin: "Siege victory", siegeLose: "Siege lost",
  scout: "Scout report", reinforceOk: "Reinforcements arrived", reinforceBack: "Reinforcements returned",
  colonizeFail: "Colonize failed", colonizeOk: "Colony founded", empty: "{mission} found nothing", home: "Army entered the city",
  noSelf: "Cannot attack yourself", noGuild: "Cannot attack the guild",
  noSelfText: "You cannot attack your own city. The army returned.", noGuildText: "You cannot attack a guild member. The army returned.",
  first: "Initiative",
  firstText: "The first entropy bit decides initiative: {side} strike first. Max width {width}. Atk {atk} / ships {atkShips}; def {def} / ships {defShips}. Morale is the field average—more campaigns, harder to break{templeNote}.",
  atk: "attackers", def: "defenders",
  templeNote: ". Temple morale +{temple}",
  seaAtk: "Sea round {n} · atk", seaDef: "Sea round {n} · def", landAtk: "Land round {n} · atk", landDef: "Land round {n} · def",
  volley: "Width {width}. Front {front} and second-row archers {rear} strike together. {hits}",
  nobody: "Nobody struck.",
  kill: "{striker}{rear} kills {tgt}{frail} (chain die {roll} < {chance})",
  miss: "{striker}{rear} fails to kill {tgt} ({roll} ≥ {chance})",
  rear: " (second-row volley)", frail: " (archers are fragile)",
  fleetBreak: "Fleet breaks", fleetBreakText: "Attacker fleet morale collapses. Transports are lost, the roster drowns.",
  portBreak: "Harbor breaks", portBreakText: "Defender fleet morale collapses.",
  sunk: "Sunk", sunkText: "No ships remain. Landing troops go into the sea and cannot return.",
  atkBreak: "Attackers break", atkBreakText: "Average campaigns {avg}, the line still failed.",
  defBreak: "Defenders break", defBreakText: "Average campaigns {avg}, the line fell apart.",
  plunder: "Plunder", plunderText: "Took {slaves} slave cards and {supplies} supply cards. Only {hurt} building levels ruined. The city did not change hands.",
  occupy: "Occupy", occupyText: "{name} changes hands. System towns cannot be destroyed; occupy, plunder, or massacre instead.",
  massacre: "Massacre", massacreText: "The city changes hands. Ruined {hurt} building levels. Gained {slaves} slave cards and {supplies} supply cards.",
  noDestroy: "Cannot destroy", noDestroyText: "{name} is a system town, so this became an occupation.",
  destroy: "Destroy", destroyText: "{name} is wiped from the map. {slaves} slave cards and {supplies} supply cards brought home.",
  scoutPeek: "Scout",
  scoutCity: "Wall campaigns {wars}. Citizens ~{cit}, roster {people}, ships {ships}, width {width}.",
  scoutOpen: "No city here. The corridor is open; you may colonize.",
  scoutBlocked: "No city here. A second city needs a conquered corridor first.",
  letter: "Letter",
  reinforceIn: "{n} entered {name}.",
  reinforceReturn: "The target is not your city. The army returned home.",
  colonizeFailText: "This tile cannot take a city. The army returned home.",
  colonizeOpen: "Founding",
  colonizeText: "{name} founded. Spent {slaves} slaves and {supplies} supplies. Person cards moved in.",
  emptyText: "No city on the target tile. {n} returned home.",
  homeText: "{n} entered your {name}.",
  loseReturn: "Defeat. Survivors returned to the origin city.",
  loot: "Slaves {slaves} · supplies {supplies}",
  dead: "Fallen: {names}",
  wild: "wilderness", enroute: "en route",
  toast: "Army mail", toastOk: "success", toastBad: "failure",
  mission_plunder: "Plunder", mission_massacre: "Massacre", mission_destroy: "Destroy", mission_occupy: "Occupy",
  mission_reinforce: "Reinforce", mission_colonize: "Colonize", mission_scout: "Scout",
};

function fromEn(over: Partial<ReportDict>): ReportDict {
  return { ...en, ...over };
}

const MORE: Partial<Record<LocaleId, Partial<ReportDict>>> = {
  es: { win: "V", lose: "D", fieldWin: "Victoria en campo", fieldLose: "Revés en campo", siegeWin: "Asedio ganado", siegeLose: "Asedio perdido", scout: "Informe de exploración", reinforceOk: "Refuerzos llegaron", reinforceBack: "Refuerzos volvieron", colonizeFail: "Colonización fallida", colonizeOk: "Colonia fundada", empty: "{mission} sin resultado", home: "El ejército entró", toast: "Correo del ejército", toastOk: "éxito", toastBad: "fracaso", wild: "páramo", letter: "Carta" },
  ar: { win: "ن", lose: "ه", fieldWin: "نصر في البر", fieldLose: "نكسة في البر", siegeWin: "سقوط الحصار لنا", siegeLose: "فشل الحصار", scout: "تقرير استطلاع", toast: "بريد الجيش", toastOk: "نجاح", toastBad: "فشل", wild: "برية" },
  fr: { win: "V", lose: "D", fieldWin: "Victoire en rase campagne", fieldLose: "Revers en rase campagne", siegeWin: "Siège gagné", siegeLose: "Siège perdu", scout: "Rapport d’éclaireurs", toast: "Courrier d’armée", toastOk: "succès", toastBad: "échec", wild: "wilderness" },
  pt: { win: "V", lose: "D", fieldWin: "Vitória em campo", fieldLose: "Revés em campo", siegeWin: "Cerco vencido", siegeLose: "Cerco perdido", scout: "Relatório de reconhecimento", toast: "Correio do exército", toastOk: "sucesso", toastBad: "falha" },
  ru: { win: "П", lose: "Пр", fieldWin: "Победа в поле", fieldLose: "Неудача в поле", siegeWin: "Осада взята", siegeLose: "Осада провалена", scout: "Донесение разведки", toast: "Почта армии", toastOk: "успех", toastBad: "неудача", wild: "пустошь" },
  ja: { win: "成", lose: "敗", fieldWin: "野外の勝利", fieldLose: "野外の敗北", siegeWin: "攻城の勝利", siegeLose: "攻城の敗北", scout: "偵察報告", toast: "軍団便り", toastOk: "成功", toastBad: "失敗", wild: "荒野" },
  de: { win: "S", lose: "N", fieldWin: "Feldsieg", fieldLose: "Feldrückschlag", siegeWin: "Belagerung gewonnen", siegeLose: "Belagerung verloren", scout: "Späherbericht", toast: "Armeepost", toastOk: "Erfolg", toastBad: "Niederlage" },
  ko: { win: "승", lose: "패", fieldWin: "야전 승리", fieldLose: "야전 패배", siegeWin: "공성 승리", siegeLose: "공성 패배", scout: "정찰 보고", toast: "군단 우편", toastOk: "성공", toastBad: "실패", wild: "황야" },
  vi: { win: "T", lose: "B", fieldWin: "Thắng dã chiến", fieldLose: "Thua dã chiến", siegeWin: "Công thành thắng", siegeLose: "Công thành thua", scout: "Báo cáo trinh sát", toast: "Thư quân đoàn", toastOk: "thành công", toastBad: "thất bại" },
  th: { win: "ชนะ", lose: "แพ้", fieldWin: "ชนะกลางป่า", fieldLose: "แพ้กลางป่า", siegeWin: "ตีเมืองได้", siegeLose: "ตีเมืองไม่สำเร็จ", scout: "รายงานลาดตระเวน", toast: "จดหมายกองทัพ" },
  id: { win: "M", lose: "K", fieldWin: "Menang di padang", fieldLose: "Kalah di padang", siegeWin: "Pengepungan menang", siegeLose: "Pengepungan kalah", scout: "Laporan pengintai", toast: "Surat pasukan" },
  it: { win: "V", lose: "S", fieldWin: "Vittoria in campo", fieldLose: "Sconfitta in campo", siegeWin: "Assedio vinto", siegeLose: "Assedio perso", scout: "Rapporto esploratori", toast: "Posta dell’esercito" },
  tr: { win: "G", lose: "M", fieldWin: "Alanda zafer", fieldLose: "Alanda bozgun", siegeWin: "Kuşatma kazanıldı", siegeLose: "Kuşatma kaybedildi", scout: "Keşif raporu", toast: "Ordu postası" },
  pl: { win: "W", lose: "P", fieldWin: "Zwycięstwo w polu", fieldLose: "Klęska w polu", siegeWin: "Oblężenie wygrane", siegeLose: "Oblężenie przegrane", scout: "Raport zwiadu", toast: "Poczta armii" },
  hi: { win: "जी", lose: "हार", fieldWin: "मैदान की जीत", fieldLose: "मैदान की हार", siegeWin: "घेराबंदी जीती", siegeLose: "घेराबंदी हारी", scout: "टोह रिपोर्ट", toast: "सेना पत्र" },
  uk: { win: "П", lose: "Пр", fieldWin: "Перемога в полі", fieldLose: "Невдача в полі", siegeWin: "Облогу взято", siegeLose: "Облогу програно", scout: "Донесення розвідки", toast: "Пошта армії" },
  nl: { win: "W", lose: "V", fieldWin: "Veldoverwinning", fieldLose: "Veldnederlaag", siegeWin: "Beleg gewonnen", siegeLose: "Beleg verloren", scout: "Verkenningsrapport", toast: "Legerpost" },
};

const PACK: Record<string, ReportDict> = { "zh-CN": zhCN, "zh-TW": zhTW, en };

function dict(locale: LocaleId): ReportDict {
  if (PACK[locale]) return PACK[locale];
  const extra = MORE[locale];
  return extra ? fromEn(extra) : en;
}

function t(locale: LocaleId, key: string, params?: Record<string, string | number | boolean | undefined>) {
  const d = dict(locale);
  const tpl = d[key] || en[key] || zhCN[key] || key;
  return fill(tpl, params);
}

function hitsOf(locale: LocaleId, raw: unknown): string {
  if (!Array.isArray(raw) || !raw.length) return t(locale, "nobody");
  return raw.map((h) => {
    const hit = h as BattleHit;
    return t(locale, hit.kind === "kill" ? "kill" : "miss", {
      striker: hit.striker,
      tgt: hit.tgt,
      roll: hit.roll,
      chance: hit.chance,
      rear: hit.rear ? t(locale, "rear") : "",
      frail: hit.frail ? t(locale, "frail") : "",
    });
  }).join(locale.startsWith("zh") ? "；" : "; ");
}

function scalar(params: BattleRound["params"] | undefined) {
  const out: Record<string, string | number | boolean | undefined> = {};
  if (!params) return out;
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) continue;
    out[k] = v;
  }
  return out;
}

const OLD_TITLE: Record<string, string> = {
  野外奏捷: "fieldWin", 野外受挫: "fieldLose", 攻城奏凯: "siegeWin", 攻城失利: "siegeLose",
  侦察回报: "scout", 增援抵达: "reinforceOk", 增援折返: "reinforceBack",
  殖民失败: "colonizeFail", 殖民成功: "colonizeOk", 军团入城: "home",
};

export function missionName(locale: LocaleId, mission?: MarchMission) {
  if (!mission) return "";
  return t(locale, `mission_${mission}`);
}

export function reportTitle(locale: LocaleId, r: BattleReport) {
  const code = r.code || OLD_TITLE[r.title];
  if (code === "empty") return t(locale, "empty", { mission: missionName(locale, r.aftermath) });
  if (code) return t(locale, code);
  return r.title;
}

export function formatRound(locale: LocaleId, round: BattleRound): { title: string; text: string } {
  if (!round.key) return { title: round.title, text: round.text };
  const p = scalar(round.params);
  if (round.key === "first") {
    return {
      title: t(locale, "first"),
      text: t(locale, "firstText", {
        ...p,
        side: t(locale, String(p.side || "atk")),
        templeNote: p.temple ? t(locale, "templeNote", { temple: p.temple }) : "",
      }),
    };
  }
  if (round.key === "seaAtk" || round.key === "seaDef" || round.key === "landAtk" || round.key === "landDef") {
    return {
      title: t(locale, round.key, p),
      text: t(locale, "volley", { ...p, hits: hitsOf(locale, round.params?.hits) }),
    };
  }
  const titleKey = {
    fleetBreak: "fleetBreak", portBreak: "portBreak", sunk: "sunk",
    atkBreak: "atkBreak", defBreak: "defBreak",
    plunder: "plunder", occupy: "occupy", massacre: "massacre",
    noDestroy: "noDestroy", destroy: "destroy",
    scoutCity: "scoutPeek", scoutOpen: "scoutPeek", scoutBlocked: "scoutPeek",
    reinforceIn: "letter", reinforceReturn: "letter",
    colonizeFailText: "letter", colonizeText: "colonizeOpen",
    emptyText: "letter", homeText: "letter", loseReturn: "letter",
    noSelfText: "letter", noGuildText: "letter",
  }[round.key] || round.key;
  const bodyKey = {
    fleetBreak: "fleetBreakText", portBreak: "portBreakText", sunk: "sunkText",
    atkBreak: "atkBreakText", defBreak: "defBreakText",
    plunder: "plunderText", occupy: "occupyText", massacre: "massacreText",
    noDestroy: "noDestroyText", destroy: "destroyText",
    scoutCity: "scoutCity", scoutOpen: "scoutOpen", scoutBlocked: "scoutBlocked",
    reinforceIn: "reinforceIn", reinforceReturn: "reinforceReturn",
    colonizeFailText: "colonizeFailText", colonizeText: "colonizeText",
    emptyText: "emptyText", homeText: "homeText", loseReturn: "loseReturn",
    noSelfText: "noSelfText", noGuildText: "noGuildText",
  }[round.key] || round.key;
  return { title: t(locale, titleKey, p), text: t(locale, bodyKey, p) };
}

export function formatReport(locale: LocaleId, r: BattleReport) {
  const title = reportTitle(locale, r);
  const badge = r.win ? t(locale, "win") : t(locale, "lose");
  const rounds = (r.rounds || []).map((x) => formatRound(locale, x));
  const loot = r.slaves || r.supplies ? t(locale, "loot", { slaves: r.slaves || 0, supplies: r.supplies || 0 }) : "";
  const dead = r.deadNames?.length ? t(locale, "dead", { names: r.deadNames.join(locale.startsWith("zh") ? "、" : ", ") }) : "";
  const aftermath = r.aftermath ? missionName(locale, r.aftermath) : "";
  return { title, badge, rounds, loot, dead, aftermath, toast: t(locale, "toast"), toastOk: t(locale, "toastOk"), toastBad: t(locale, "toastBad") };
}

export function reportHay(locale: LocaleId, r: BattleReport) {
  const f = formatReport(locale, r);
  return [f.badge, f.title, f.aftermath, f.loot, f.dead, ...f.rounds.flatMap((x) => [x.title, x.text])].join(" ").toLowerCase();
}
