import { useEffect, useMemo, useRef, useState } from "react";
import { BUILDINGS, COLONIZE_COST, MISSION_NAME, PLOT_NAME, PLOT_TIME, ROLES, scaleTime, SUPPLY_PER_SLAVE } from "./engine/catalog";
import { chartName, chartOf, cityIdAt, npcAt, terrainAt, tileName } from "./engine/map";
import { planPath } from "./engine/path";
import { canBuildOn, plotTimeMult } from "./engine/plots";
import { empireTimeFactor, slaveCostFor, workersFor } from "./engine/site";
import { adjacentClaimed, claimsGap, isClaimed } from "./engine/realm";
import { buildSlotsOf, citizensOf, corridorBlocked, idleSlaves, idleSupply, idleWorkers, recruitCapOf, roleCapOf, roleCountOf, worksOf } from "./engine/simulate";
import { loadInbox, mergeInbox } from "./lib/inbox";
import { HelpBoard } from "./i18n/HelpBoard";
import { LangSelect, useI18n } from "./i18n";
import { useGame } from "./hooks/useGame";
import { makeCommand, statusLabel } from "./lib/cmd";
import { arToWinston, winstonToAr } from "./lib/market";
import { shortAddr } from "./lib/wallet";
import { AtlasCanvas } from "./scene/AtlasCanvas";
import { CityCanvas } from "./scene/CityCanvas";
import { WorldCanvas } from "./scene/WorldCanvas";
import type { BuildingId, MarchMission, RoleId } from "./types";

function remain(ms: number, now: number) {
  const s = Math.max(0, Math.ceil((ms - now) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`;
}

type Modal = "none" | "tile" | "city" | "recruit" | "squad" | "build" | "card" | "reports" | "market" | "guild" | "atlas" | "help";
type RosterTab = "cities" | "people" | "slaves" | "goods" | "marches";
type BoardCat = "all" | "win" | "lose" | "scout" | "colonize" | "fight" | "reinforce" | "mine" | "join" | "big" | "foot" | "bow" | "horse" | "navy" | "cheap";

function hay(parts: (string | number | undefined)[]) {
  return parts.filter((x) => x !== undefined).join(" ").toLowerCase();
}

function marketBucket(role?: string) {
  if (role === "toxotes") return "bow";
  if (role === "hippeus") return "horse";
  if (role === "epibatai" || role === "trierarch") return "navy";
  if (role === "hoplite" || role === "peltast" || role === "citizen") return "foot";
  return "other";
}

export function App() {
  const { t } = useI18n();
  const g = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<Modal>("none");
  const [inside, setInside] = useState(false);
  const [pickedP, setPickedP] = useState<string[]>([]);
  const [pickedS, setPickedS] = useState<string[]>([]);
  const [cityName, setCityName] = useState("新城邦");
  const [mission, setMission] = useState<MarchMission>("plunder");
  const [buildId, setBuildId] = useState<BuildingId>("oikos");
  const [cardId, setCardId] = useState<string>("");
  const [listAr, setListAr] = useState("0.1");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [cityPins, setCityPins] = useState<{ id: string; name: string; x: number; y: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("rexue-chengbang-my-cities") || "[]") as { id: string; name: string; x: number; y: number }[];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!g.myCities.length) return;
    const pins = g.myCities.map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y }));
    setCityPins(pins);
    try {
      localStorage.setItem("rexue-chengbang-my-cities", JSON.stringify(pins));
    } catch { /* ignore */ }
  }, [g.myCities]);

  const rosterCities = g.myCities.length ? g.myCities : cityPins;
  const [rosterTab, setRosterTab] = useState<RosterTab>("cities");
  const [fromCityId, setFromCityId] = useState("");
  const [plotId, setPlotId] = useState("");
  const [guildName, setGuildName] = useState("新城邦同盟");
  const [boardQ, setBoardQ] = useState("");
  const [boardCat, setBoardCat] = useState<BoardCat>("all");

  const sim = g.sim;
  const city = g.activeCity;
  const origin = g.myCities.find((c) => c.id === fromCityId) || g.myCities[0] || null;
  const mine = Boolean(city && g.address && city.owner === g.address);
  const here = city && mine
    ? Object.values(g.world.cards).filter((c) => c.owner === g.address && c.cityId === city.id && !c.marchId)
    : [];
  const originHere = origin && g.address
    ? Object.values(g.world.cards).filter((c) => c.owner === g.address && c.cityId === origin.id && !c.marchId)
    : [];
  const people = here.filter((c) => c.kind === "person" || c.kind === "slave");
  const originPeople = originHere.filter((c) => c.kind === "person" || c.kind === "slave");
  const ships = (inside ? here : originHere).filter((c) => c.kind === "ship");
  const slaves = here.filter((c) => c.kind === "slave");
  const goods = here.filter((c) => c.kind === "supply");
  const sel = g.selected;
  const selCity = sel ? sim.cities[cityIdAt(sel.x, sel.y)] : undefined;
  const ownSel = Boolean(selCity && g.address && selCity.owner === g.address);
  const selNpc = sel && !selCity ? npcAt(sel.x, sel.y) : null;
  const path = origin && sel ? planPath(origin.x, origin.y, sel.x, sel.y, true) : null;
  const blocked = origin && path?.ok && mission !== "scout"
    ? corridorBlocked(sim, path.tiles, g.address, sel!.x, sel!.y)
    : null;
  const claimMiss = origin && path?.ok && sel && mission === "colonize"
    ? claimsGap(sim, g.address, path.tiles, sel.x, sel.y)
    : null;
  const myGuildId = g.address ? sim.memberOf?.[g.address] : "";
  const myGuild = myGuildId ? sim.guilds?.[myGuildId] : undefined;
  const focusPlot = city?.plots?.find((p) => p.id === plotId);
  const peopleN = city && mine ? Object.values(g.world.cards).filter((c) => c.cityId === city.id && c.kind === "person").length : 0;
  const slaveN = slaves.length;
  const timeFactor = empireTimeFactor(
    g.myCities.length,
    Object.values(sim.cards).filter((c) => c.owner === g.address && c.kind === "person").length,
    Object.values(sim.cards).filter((c) => c.owner === g.address && c.kind === "slave").length,
  );
  const focusCard = cardId ? g.world.cards[cardId] || sim.cards[cardId] : undefined;
  const incoming = useMemo(
    () => Object.values(sim.marches).filter((m) => city && m.toX === city.x && m.toY === city.y && m.owner !== g.address),
    [sim.marches, city, g.address],
  );
  const [inbox, setInbox] = useState(() => loadInbox(""));
  useEffect(() => {
    if (!g.address) {
      setInbox([]);
      return;
    }
    const live = (sim.reports || []).filter((r) => r.attacker === g.address || r.defender === g.address);
    setInbox(mergeInbox(g.address, live));
  }, [g.address, sim.reports]);
  const mineReports = inbox;
  const [seenReports, setSeenReports] = useState<Record<string, true>>(() => {
    try {
      return JSON.parse(localStorage.getItem("rexue-chengbang-seen-reports") || "{}") as Record<string, true>;
    } catch {
      return {};
    }
  });
  const unreadReports = mineReports.filter((r) => !seenReports[r.id]);
  const [toast, setToast] = useState<(typeof mineReports)[0] | null>(null);

  useEffect(() => {
    const latest = unreadReports[0];
    if (!latest) return;
    setToast(latest);
    const t = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(t);
  }, [unreadReports[0]?.id]);

  function openReports() {
    const next = { ...seenReports };
    for (const r of mineReports) next[r.id] = true;
    setSeenReports(next);
    try {
      localStorage.setItem("rexue-chengbang-seen-reports", JSON.stringify(next));
    } catch { /* ignore */ }
    setToast(null);
    setBoardQ("");
    setBoardCat("all");
    setRosterOpen(false);
    setModal("reports");
  }

  function openBoard(kind: "market" | "guild" | "atlas" | "help") {
    setBoardQ("");
    setBoardCat("all");
    setRosterOpen(false);
    setModal(kind);
  }

  const boardModal = modal === "reports" || modal === "market" || modal === "guild" || modal === "atlas" || modal === "help";

  const filteredReports = useMemo(() => {
    const q = boardQ.trim().toLowerCase();
    return mineReports.filter((r) => {
      if (boardCat === "win" && !r.win) return false;
      if (boardCat === "lose" && r.win) return false;
      if (boardCat === "scout" && !r.title.includes("侦察")) return false;
      if (boardCat === "colonize" && r.aftermath !== "colonize" && !r.title.includes("殖民")) return false;
      if (boardCat === "reinforce" && r.aftermath !== "reinforce" && !r.title.includes("增援")) return false;
      if (boardCat === "fight" && r.aftermath !== "plunder" && r.aftermath !== "massacre" && r.aftermath !== "occupy" && r.aftermath !== "destroy" && !r.title.includes("攻") && !r.title.includes("野")) return false;
      if (!q) return true;
      return hay([r.title, r.x, r.y, r.aftermath, ...(r.rounds || []).flatMap((x) => [x.title, x.text]), ...(r.deadNames || [])]).includes(q);
    });
  }, [mineReports, boardQ, boardCat]);

  const filteredListings = useMemo(() => {
    const q = boardQ.trim().toLowerCase();
    const rows = Object.values(sim.listings).map((listing) => ({ listing, card: sim.cards[listing.cardId] }));
    const next = rows.filter(({ listing, card }) => {
      if (boardCat === "mine" && listing.seller !== g.address) return false;
      if (boardCat === "foot" || boardCat === "bow" || boardCat === "horse" || boardCat === "navy") {
        if (marketBucket(card?.role) !== boardCat) return false;
      }
      if (!q) return true;
      return hay([card?.name, card?.role, card?.role ? ROLES[card.role].name : "", listing.seller, winstonToAr(listing.winston)]).includes(q);
    });
    if (boardCat === "cheap") next.sort((a, b) => a.listing.winston - b.listing.winston);
    return next;
  }, [sim.listings, sim.cards, boardQ, boardCat, g.address]);

  const filteredGuilds = useMemo(() => {
    const q = boardQ.trim().toLowerCase();
    return Object.values(sim.guilds || {}).filter((guild) => {
      if (boardCat === "mine" && guild.id !== myGuildId) return false;
      if (boardCat === "join" && (Boolean(myGuild) || guild.members.includes(g.address))) return false;
      if (boardCat === "big" && guild.members.length < 5) return false;
      if (!q) return true;
      return hay([guild.name, guild.leader, ...guild.members, guild.members.length]).includes(q);
    });
  }, [sim.guilds, boardQ, boardCat, myGuildId, myGuild, g.address]);

  const atlasHits = useMemo(() => {
    const q = boardQ.trim();
    const hits: { cx: number; cy: number; label: string }[] = [];
    const seen = new Set<string>();
    const add = (cx: number, cy: number, label: string) => {
      const k = `${cx}:${cy}`;
      if (seen.has(k)) return;
      seen.add(k);
      hits.push({ cx, cy, label });
    };
    const coord = q.match(/^(-?\d+)\s*[,，]\s*(-?\d+)$/);
    if (coord) add(Number(coord[1]), Number(coord[2]), `${chartName(Number(coord[1]), Number(coord[2]))} (${coord[1]},${coord[2]})`);
    for (const c of rosterCities) {
      const ch = chartOf(c.x, c.y);
      add(ch.cx, ch.cy, `${c.name} · ${chartName(ch.cx, ch.cy)}`);
    }
    const needle = q.toLowerCase();
    for (let cy = g.chart.cy - 7; cy <= g.chart.cy + 7; cy += 1) {
      for (let cx = g.chart.cx - 7; cx <= g.chart.cx + 7; cx += 1) {
        const name = chartName(cx, cy);
        if (!needle || name.toLowerCase().includes(needle) || `${cx},${cy}`.includes(needle)) add(cx, cy, `${name} (${cx},${cy})`);
      }
    }
    return hits.slice(0, 40);
  }, [boardQ, rosterCities, g.chart]);
  const buildSlots = city ? buildSlotsOf(city) : 1;
  const busyJobs = city ? Object.values(city.buildings).filter((b) => b?.job).length : 0;
  const pendingBuild = g.pending.filter((c) => c.kind === "upgrade" && c.cityId === city?.id).length;
  const busyBuild = busyJobs + pendingBuild >= buildSlots;

  function toggle(id: string, list: string[], set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const myCards = useMemo(
    () => Object.values(sim.cards).filter((c) => c.owner === g.address),
    [sim.cards, g.address],
  );
  const myMarches = useMemo(
    () => Object.values(sim.marches).filter((m) => m.owner === g.address),
    [sim.marches, g.address],
  );
  const cityNameOf = (id: string) => sim.cities[id]?.name || "途中";

  function jumpCity(id: string, enter = false) {
    const c = sim.cities[id] || rosterCities.find((x) => x.id === id);
    if (!c) return;
    if (sim.cities[id] && sim.cities[id].owner !== g.address) return;
    g.setFocusCityId(c.id);
    setFromCityId(c.id);
    const ch = chartOf(c.x, c.y);
    g.enterChart(ch.cx, ch.cy, { x: c.x, y: c.y });
    setInside(enter && Boolean(sim.cities[id]));
    setModal("none");
    setRosterOpen(false);
  }

  function jumpCard(id: string) {
    const card = sim.cards[id];
    if (!card || card.owner !== g.address) return;
    const home = sim.cities[card.cityId];
    if (home && home.owner === g.address) {
      g.setFocusCityId(home.id);
      const ch = chartOf(home.x, home.y);
      g.enterChart(ch.cx, ch.cy, { x: home.x, y: home.y });
    }
    setCardId(card.id);
    setInside(false);
    setModal("card");
    setRosterOpen(false);
  }

  function enterOwnCity(id: string) {
    const c = sim.cities[id];
    if (!c || c.owner !== g.address) {
      setModal("tile");
      return;
    }
    g.setFocusCityId(id);
    setFromCityId(id);
    g.setSelected({ x: c.x, y: c.y });
    setInside(true);
    setModal("none");
  }

  return (
    <div className="app app-3d">
      <header className="top">
        <div className="brand cinzel">
          <b>热血城邦</b>
          <span>完全免费 · 游戏内钱包 · 操作都在游戏里</span>
        </div>
        <nav className="top-nav">
          <button className="btn tiny" onClick={openReports}>
            {t("reports")}{unreadReports.length ? ` ${unreadReports.length}` : ""}
          </button>
          <button className="btn tiny" onClick={() => openBoard("market")}>{t("market")}</button>
          <button className="btn tiny" onClick={() => openBoard("guild")}>{t("guild")}</button>
          <button className="btn tiny" onClick={() => openBoard("atlas")}>{t("atlas")}</button>
          <button className="btn tiny" onClick={() => openBoard("help")}>{t("help")}</button>
          <LangSelect compact />
          <button className="btn tiny primary" onClick={() => setRosterOpen((v) => !v)}>
            {rosterOpen ? "收起名册" : "我的名册"}
          </button>
          {(g.myCities[0] || rosterCities[0]) && !inside ? (
            <button className="btn tiny" onClick={() => jumpCity((g.myCities[0] || rosterCities[0]).id)}>一键回城</button>
          ) : null}
          {mine && !inside ? <button className="btn tiny" onClick={() => { setInside(true); setModal("none"); }}>进入城市</button> : null}
          {inside ? <button className="btn tiny" onClick={() => setInside(false)}>回到大地图</button> : null}
          {inside && mine ? (
            <>
              <button className="btn tiny primary" onClick={() => setModal("recruit")}>招募人物卡</button>
              <button className="btn tiny" onClick={() => { setPlotId(""); setModal("build"); }}>建造</button>
            </>
          ) : null}
          {incoming.length ? <span className="err">敌军逼近 {incoming.length} 支</span> : null}
        </nav>
        {g.busy ? <span className="busy">{g.busy}</span> : null}
        {g.error ? <span className="err">{g.error}</span> : null}
        {sim.skipped.slice(-1).map((s) => <span className="err" key={s}>{s}</span>)}
        <div className="top-actions">
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) g.doImport(await f.text());
            e.target.value = "";
          }} />
          {g.address ? (
            <>
              <span className="muted">{shortAddr(g.address)} · 本城 人{peopleN} 奴{slaveN} 物资{goods.length} 城{Math.max(g.myCities.length, rosterCities.length)}</span>
              <button className="btn" onClick={g.doExport}>导出钱包</button>
              <button className="btn" onClick={g.logout}>退出</button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={g.create}>游戏内创建钱包</button>
              <button className="btn" onClick={() => fileRef.current?.click()}>导入钱包</button>
            </>
          )}
        </div>
      </header>

      <div className="stage">
        {inside && city && mine ? (
          <CityCanvas
            city={city}
            world={g.world}
            now={g.now}
            onPlot={(id) => { setPlotId(id); setModal("build"); }}
            onBuilding={(id, pid) => { setBuildId(id); setPlotId(pid); setModal("build"); }}
            onCard={(id) => { setCardId(id); setModal("card"); }}
          />
        ) : (
          <WorldCanvas
            world={g.world}
            now={g.now}
            chart={g.chart}
            view={g.view}
            selected={g.selected}
            address={g.address}
            onSelect={(x, y) => { g.setSelected({ x, y }); setModal("tile"); }}
            onView={(x, y) => g.setView({ x, y })}
            onEnterCity={enterOwnCity}
          />
        )}
        {!inside ? (
          <div className="chart-pad">
            <span className="muted">{chartName(g.chart.cx, g.chart.cy)}</span>
            <button className="btn tiny" onClick={() => g.goChart(0, -1)}>北</button>
            <button className="btn tiny" onClick={() => g.goChart(0, 1)}>南</button>
            <button className="btn tiny" onClick={() => g.goChart(-1, 0)}>西</button>
            <button className="btn tiny" onClick={() => g.goChart(1, 0)}>东</button>
          </div>
        ) : null}
      </div>

      {rosterOpen ? (
          <aside className="map-menu">
            <div className="map-menu-head">
              <b>我的名册</b>
              <span className="muted">点一项才跳转，不铺在地图上</span>
              <button className="btn tiny" style={{ marginLeft: "auto" }} onClick={() => setRosterOpen(false)}>关闭</button>
            </div>
            <div className="map-menu-tabs">
              {([
                ["cities", `城邦 ${rosterCities.length}`],
                ["people", `人物 ${myCards.filter((c) => c.kind === "person").length}`],
                ["slaves", `奴隶 ${myCards.filter((c) => c.kind === "slave").length}`],
                ["goods", `物资 ${myCards.filter((c) => c.kind === "supply").length}`],
                ["marches", `行军 ${myMarches.length}`],
              ] as [RosterTab, string][]).map(([id, label]) => (
                <button key={id} className={rosterTab === id ? "on" : ""} onClick={() => setRosterTab(id)}>{label}</button>
              ))}
            </div>
            <div className="map-menu-body">
              {rosterTab === "cities" ? (
                rosterCities.length ? rosterCities.map((c) => (
                  <div className="card" key={c.id}>
                    <div>{c.name}<small>({c.x},{c.y}){"wars" in c && Array.isArray(c.wars) ? ` · 战${c.wars.length}` : ""}</small></div>
                    <div className="row">
                      <button className="btn tiny" onClick={() => jumpCity(c.id)}>定位</button>
                      <button className="btn tiny" onClick={() => jumpCity(c.id, true)}>进入</button>
                    </div>
                  </div>
                )) : <p className="muted">还没有城邦。在荒野加入建城指令。</p>
              ) : null}
              {rosterTab === "people" ? (
                myCards.filter((c) => c.kind === "person").length === 0 ? <p className="muted">没有人物卡。</p> :
                myCards.filter((c) => c.kind === "person").map((c) => (
                  <div className="card" key={c.id} onClick={() => jumpCard(c.id)}>
                    <div>{c.name}<small>{ROLES[c.role].name} · {cityNameOf(c.cityId)}{c.marchId ? " · 出征" : ""}{c.jobId ? " · 监工" : ""}</small></div>
                    <button className="btn tiny">查找</button>
                  </div>
                ))
              ) : null}
              {rosterTab === "slaves" ? (
                myCards.filter((c) => c.kind === "slave").length === 0 ? <p className="muted">没有奴隶卡。</p> :
                myCards.filter((c) => c.kind === "slave").map((c) => (
                  <div className="card" key={c.id} onClick={() => jumpCard(c.id)}>
                    <div>{c.name}<small>{cityNameOf(c.cityId)}{c.marchId ? " · 出征" : ""}</small></div>
                    <button className="btn tiny">查找</button>
                  </div>
                ))
              ) : null}
              {rosterTab === "goods" ? (
                myCards.filter((c) => c.kind === "supply").length
                  ? <p className="muted">物资卡 {myCards.filter((c) => c.kind === "supply").length} 张，按城存放，点城邦定位。</p>
                  : <p className="muted">没有物资卡。</p>
              ) : null}
              {rosterTab === "goods" ? (
                g.myCities.map((c) => {
                  const n = myCards.filter((x) => x.kind === "supply" && x.cityId === c.id).length;
                  if (!n) return null;
                  return (
                    <div className="card" key={c.id}>
                      <div>{c.name}<small>物资 {n}</small></div>
                      <button className="btn tiny" onClick={() => jumpCity(c.id)}>定位</button>
                    </div>
                  );
                })
              ) : null}
              {rosterTab === "marches" ? (
                myMarches.length ? myMarches.map((m) => (
                  <div className="card" key={m.id} onClick={() => {
                    const ch = chartOf(m.toX, m.toY);
                    g.enterChart(ch.cx, ch.cy, { x: m.toX, y: m.toY });
                    setRosterOpen(false);
                  }}>
                    <div>{MISSION_NAME[m.mission]}<small>去 ({m.toX},{m.toY}) · {m.personIds.length} 人</small></div>
                    <button className="btn tiny">查找</button>
                  </div>
                )) : <p className="muted">没有在途军团。</p>
              ) : null}
            </div>
          </aside>
        ) : null}

      {toast ? (
        <button className="report-toast" onClick={openReports}>
          <b>军团回报</b> {toast.win ? "成功" : "失败"} · {toast.title}
          {toast.slaves || toast.supplies ? ` · 奴隶${toast.slaves || 0} 物资${toast.supplies || 0}` : ""}
          {toast.deadNames?.length ? ` · 阵亡${toast.deadNames.length}` : ""}
        </button>
      ) : null}

      {modal !== "none" ? (
        <div className="modal-back" onClick={() => setModal("none")}>
          <div className={boardModal ? "modal board" : "modal"} onClick={(e) => e.stopPropagation()}>
            <button className="btn tiny modal-x" onClick={() => setModal("none")}>{t("close")}</button>
            {modal === "tile" && sel ? (
              <>
                <h3>{sel.x},{sel.y} {tileName(terrainAt(sel.x, sel.y))}</h3>
                {selCity && ownSel ? (
                  <p>{selCity.name} · 宽{selCity.frontage} · 战{selCity.wars.length}</p>
                ) : selCity ? (
                  <p>
                    此地不属于你，无法加载城内名册、建筑与奴隶。只能看见这里有一座
                    {selCity.systemRank ? (selCity.systemRank === "metro" ? "系统都市" : selCity.systemRank === "city" ? "系统城市" : "系统小镇") : selCity.npc ? ` ${selCity.tribeLevel || 1}级固定聚落` : "城"}。
                    {selCity.systemRank ? " 可占领、劫掠、屠城，不能毁灭。" : ""}
                  </p>
                ) : selNpc ? (
                  <p>{selNpc.name} 固定在这格刷新，不会搬家。等级 {selNpc.level}。未攻下前看不到里面的人。打下来后这格才算连通。</p>
                ) : (
                  <p>
                    {g.myCities.length
                      ? `第二座城必须与已打下来的格子连通。出征「开辟殖民市」：人物卡 ${COLONIZE_COST.persons}，消耗奴隶 ${COLONIZE_COST.slaves}、物资 ${COLONIZE_COST.supplies}。侦察邻格可占领空地。公会共享连通。海域、山地都可以殖民。`
                      : terrainAt(sel.x, sel.y) === "sea"
                        ? "第一座城可以建在海域，建成海港城，自带港口、船厂和运输船。"
                        : terrainAt(sel.x, sel.y) === "mountain"
                          ? "第一座城可以建在山地。山城易守，没有港口，翻山行军更慢。"
                          : "第一座城：平原、森林、海岸、山地、海域都可以建。"}
                  </p>
                )}
                {g.address && sel ? (
                  <p className="muted">
                    {isClaimed(sim, g.address, sel.x, sel.y) ? "此格已打下来（你或公会）" : adjacentClaimed(sim, g.address, sel.x, sel.y) ? "邻格已连通，侦察此格可打下空地" : "尚未连通"}
                  </p>
                ) : null}
                {path?.ok ? <p className="muted">{path.naval ? "海路" : "陆路"} {path.dist} 格</p> : path && !path.ok ? <p className="err">{path.reason}</p> : null}
                {blocked ? <p className="err">{blocked}</p> : null}
                {claimMiss ? <p className="err">{claimMiss}</p> : null}
                {!g.address ? <p>先创建钱包。</p> : null}
                {g.address && !g.myCities.length ? (
                  <>
                    <input value={cityName} onChange={(e) => setCityName(e.target.value)} />
                    <button className="btn primary" onClick={() => {
                      g.addCommand(makeCommand({ kind: "found_city", label: `建城 ${cityName} (${sel.x},${sel.y})`, x: sel.x, y: sel.y, name: cityName }));
                      const pin = { id: cityIdAt(sel.x, sel.y), name: cityName, x: sel.x, y: sel.y };
                      setCityPins((prev) => {
                        const next = [...prev.filter((p) => p.id !== pin.id), pin];
                        try {
                          localStorage.setItem("rexue-chengbang-my-cities", JSON.stringify(next));
                        } catch { /* ignore */ }
                        return next;
                      });
                      setModal("none");
                    }}>加入建城指令</button>
                  </>
                ) : null}
                {ownSel ? (
                  <button className="btn" onClick={() => enterOwnCity(selCity!.id)}>进入城市</button>
                ) : null}
                {origin && sel ? (
                  <>
                    <p>出征必须指定<strong>出发城邦</strong>和<strong>将士</strong>。点地块只是目标，不会自动派兵。</p>
                    <label className="muted">出发城邦
                      <select value={origin.id} onChange={(e) => {
                        setFromCityId(e.target.value);
                        g.setFocusCityId(e.target.value);
                      }}>
                        {g.myCities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.x},{c.y})</option>)}
                      </select>
                    </label>
                    <div className="row">
                      <select value={mission} onChange={(e) => setMission(e.target.value as MarchMission)}>
                        {(Object.keys(MISSION_NAME) as MarchMission[]).filter((m) => !(m === "destroy" && selCity?.systemRank)).map((m) => <option key={m} value={m}>{MISSION_NAME[m]}</option>)}
                      </select>
                      <button className="btn primary" onClick={() => setModal("squad")} disabled={(Boolean(blocked) && mission !== "scout") || Boolean(claimMiss)}>挑选将士出征</button>
                    </div>
                    <p className="muted">当前从 {origin.name} 出发，本城可派 {originPeople.filter((c) => !c.jobId).length} 人。</p>
                  </>
                ) : null}
              </>
            ) : null}

            {modal === "city" && city && mine ? (
              <>
                <h3>{city.name}</h3>
                <p>公民 {citizensOf(city, sim)} · 招募上限 {recruitCapOf(city)} · 成果 {worksOf(city, sim)} · 本城奴隶 {slaveN} · 物资 {goods.length}</p>
                <p className="muted">奴隶不能招募。物资可买奴隶，奴隶可转公民。建造占用监工人物卡和物资/奴隶，完成后才释放。</p>
                <div className="row">
                  <button className="btn" onClick={() => setModal("recruit")}>招募 / 买奴</button>
                  <button className="btn" onClick={() => setModal("squad")}>出征</button>
                  <button className="btn" onClick={() => setModal("build")}>建筑</button>
                </div>
              </>
            ) : null}

            {modal === "build" && city && mine ? (
              <>
                <h3>建造 · 一块空地一座建筑</h3>
                {busyBuild ? <p className="err">同时在建已满：市政广场允许 {buildSlots} 座（在建 {busyJobs}、已排队 {pendingBuild}）。</p> : null}
                <p className="muted">
                  空地 {city.plots.filter((p) => p.building).length}/{city.plots.length}
                  {" · "}空闲监工 {idleWorkers(sim, city.id, g.address).length}
                  {" · "}物资 {idleSupply(sim, city.id).length}
                  {" · "}可折奴隶 {idleSlaves(sim, city.id).length}
                </p>
                {focusPlot ? (
                  <p>
                    {PLOT_NAME[focusPlot.kind]} ({focusPlot.lx},{focusPlot.ly})
                    {focusPlot.building ? ` · 已有${BUILDINGS[focusPlot.building].name}` : " · 空地"}
                    · 工期×{(PLOT_TIME[focusPlot.kind] * focusPlot.timeMult).toFixed(2)}
                  </p>
                ) : (
                  <p className="muted">点城里一块空地来建造。世界地形决定本城有多少广场、民宅、校场、林地、石场、港湾。</p>
                )}
                {(Object.keys(BUILDINGS) as BuildingId[]).filter((bid) => {
                  if (focusPlot?.building) return bid === focusPlot.building;
                  if (focusPlot) return canBuildOn(bid, focusPlot.kind) && !city.plots.some((p) => p.building === bid);
                  return Boolean(city.buildings[bid]?.level);
                }).map((bid) => {
                  const def = BUILDINGS[bid];
                  const lv = city.buildings[bid]?.level || 0;
                  const job = city.buildings[bid]?.job;
                  const cost = slaveCostFor(lv + 1);
                  const workers = workersFor(lv + 1);
                  const sec = scaleTime(def.baseTime, lv + 1, plotTimeMult(city, bid, focusPlot) * timeFactor);
                  return (
                    <div className="bld" key={bid}>
                      <div>
                        {def.name} {lv}级 · 料{cost} · 监工{workers} · 约{sec}秒
                        <div className="muted">{def.blurb}{job ? ` · 在建至${job.to}级 ${remain(job.finishAt, g.now)}` : ""}</div>
                      </div>
                      <button className="btn tiny" disabled={busyBuild} onClick={() => {
                        g.addCommand(makeCommand({
                          kind: "upgrade",
                          label: `建造 ${def.name}（料${cost}/监工${workers}）`,
                          cityId: city.id,
                          building: bid,
                          plotId: focusPlot?.id,
                        }));
                        setModal("none");
                      }}>{lv < 1 ? "在此空地建造" : "升级"}</button>
                    </div>
                  );
                })}
              </>
            ) : null}

            {modal === "recruit" && city && mine ? (
              <>
                <h3>招募 总上限 {recruitCapOf(city)}</h3>
                <p className="muted">奴隶不能招募。用 {SUPPLY_PER_SLAVE} 张本城物资买一张奴隶，或把奴隶转成公民。每种兵由对应建筑等级决定上限；弓手站第二排放箭，但更脆弱。</p>
                <button className="btn" onClick={() => {
                  g.addCommand(makeCommand({ kind: "buy_slave", label: `买奴隶（耗物资${SUPPLY_PER_SLAVE}）`, cityId: city.id }));
                  setModal("none");
                }}>用物资买奴隶</button>
                {slaves.map((s) => (
                  <div className="card" key={s.id}>
                    <div>{s.name}<small>转公民占招募名额</small></div>
                    <button className="btn tiny" onClick={() => {
                      g.addCommand(makeCommand({ kind: "enfranchise", label: `转公民 ${s.name}`, cityId: city.id, cardId: s.id }));
                      setModal("none");
                    }}>转公民</button>
                  </div>
                ))}
                {(Object.keys(ROLES) as RoleId[]).filter((r) => (ROLES[r].kind === "person" && r !== "citizen") || ROLES[r].kind === "ship").map((role) => {
                  const cap = roleCapOf(city, role);
                  const have = roleCountOf(sim, city.id, role);
                  return (
                    <div className="card" key={role}>
                      <div>
                        {ROLES[role].name}
                        <small>{ROLES[role].blurb} · {have}/{cap === 99 ? "—" : cap}</small>
                      </div>
                      <button className="btn tiny" disabled={cap !== 99 && have >= cap} onClick={() => {
                        g.addCommand(makeCommand({ kind: "recruit", label: `招募 ${ROLES[role].name}`, cityId: city.id, role }));
                        setModal("none");
                      }}>加入</button>
                    </div>
                  );
                })}
              </>
            ) : null}

            {modal === "squad" && origin ? (
              <>
                <h3>从 {origin.name} 出征 · {MISSION_NAME[mission]}</h3>
                <p className="muted">必须勾选将士。目标是大地图点中的格子，出发城是上面选的城。</p>
                {blocked && mission !== "scout" ? <p className="err">{blocked}</p> : null}
                {originPeople.filter((c) => !c.jobId && !c.listedWinston).length === 0 ? <p className="err">出发城里没有空闲将士。</p> : null}
                {originPeople.filter((c) => !c.jobId && !c.listedWinston).map((c) => (
                  <label key={c.id} className="card">
                    <div>{c.name}<small>{ROLES[c.role].name} · {c.campaigns.length}战{c.jobId ? " · 监工中" : ""}</small></div>
                    <input type="checkbox" checked={pickedP.includes(c.id)} onChange={() => toggle(c.id, pickedP, setPickedP)} />
                  </label>
                ))}
                {ships.map((c) => (
                  <label key={c.id} className="card">
                    <div>{c.name}<small>{ROLES[c.role].name}</small></div>
                    <input type="checkbox" checked={pickedS.includes(c.id)} onChange={() => toggle(c.id, pickedS, setPickedS)} />
                  </label>
                ))}
                {sel ? (
                  <button className="btn primary" disabled={(Boolean(blocked) && mission !== "scout") || pickedP.length === 0} onClick={() => {
                    g.addCommand(makeCommand({
                      kind: "march",
                      label: `${MISSION_NAME[mission]} 从${origin.name} → (${sel.x},${sel.y})`,
                      fromCityId: origin.id,
                      cityId: origin.id,
                      toX: sel.x,
                      toY: sel.y,
                      personIds: pickedP,
                      shipIds: pickedS,
                      mission,
                    }));
                    setModal("none");
                  }}>加入出征指令</button>
                ) : <p className="muted">先在大地图点一个目标。</p>}
              </>
            ) : null}

            {modal === "card" && focusCard ? (
              <>
                <h3>{focusCard.name}</h3>
                <p>{ROLES[focusCard.role]?.name} · {focusCard.kind === "slave" ? "奴隶" : focusCard.kind === "supply" ? "物资" : "人物"}</p>
                {focusCard.kind === "person" || focusCard.kind === "slave" ? (
                  <p>战役：{focusCard.campaigns.length ? focusCard.campaigns.map((w) => w.name).join("、") : "尚未上阵"}</p>
                ) : null}
                {focusCard.kind === "person" && focusCard.owner === g.address && !focusCard.listedWinston ? (
                  <div className="row">
                    <input value={listAr} onChange={(e) => setListAr(e.target.value)} />
                    <button className="btn" onClick={() => {
                      const winston = arToWinston(Number(listAr) || 0);
                      g.addCommand(makeCommand({
                        kind: "list_card",
                        label: `上架 ${focusCard.name}（定价 ${winstonToAr(winston)} AR，上架免费）`,
                        cardId: focusCard.id,
                        priceWinston: winston,
                      }));
                      setModal("none");
                    }}>上架（免费，成交抽10%手续费）</button>
                  </div>
                ) : null}
                {focusCard.kind === "slave" && mine ? (
                  <button className="btn" onClick={() => {
                    g.addCommand(makeCommand({ kind: "enfranchise", label: `转公民 ${focusCard.name}`, cityId: city?.id, cardId: focusCard.id }));
                    setModal("none");
                  }}>招募为公民</button>
                ) : null}
                {(focusCard.kind === "person" || focusCard.kind === "slave") && !focusCard.jobId ? (
                  <button className="btn" onClick={() => toggle(focusCard.id, pickedP, setPickedP)}>
                    {pickedP.includes(focusCard.id) ? "移出出征勾选" : "勾选出征"}
                  </button>
                ) : null}
              </>
            ) : null}

            {modal === "market" ? (
              <>
                <h3>{t("marketTitle")}</h3>
                <p className="muted">{t("marketHint")}</p>
                <input className="board-search" value={boardQ} onChange={(e) => setBoardQ(e.target.value)} placeholder={t("marketSearch")} />
                <div className="board-cats">
                  {([["all", "catAll"], ["mine", "catMine"], ["foot", "catFoot"], ["bow", "catBow"], ["horse", "catHorse"], ["navy", "catNavy"], ["cheap", "catCheap"]] as [BoardCat, "catAll" | "catMine" | "catFoot" | "catBow" | "catHorse" | "catNavy" | "catCheap"][]).map(([id, key]) => (
                    <button key={id} className={`btn tiny${boardCat === id ? " primary" : ""}`} onClick={() => setBoardCat(id)}>{t(key)}</button>
                  ))}
                </div>
                <div className="board-body">
                  <div className="board-grid">
                    {filteredListings.length ? filteredListings.map(({ listing, card }) => (
                      <div className="card" key={listing.id}>
                        <div>
                          {card?.name || listing.cardId}
                          <small>{card?.role ? ROLES[card.role].name : "人物"} · {winstonToAr(listing.winston)} AR · {shortAddr(listing.seller)}</small>
                        </div>
                        {listing.seller === g.address ? (
                          <button className="btn tiny" onClick={() => {
                            g.addCommand(makeCommand({ kind: "delist_card", label: `撤架 ${card?.name || ""}`, listingId: listing.id }));
                          }}>撤架</button>
                        ) : (
                          <button className="btn tiny" onClick={async () => {
                            if (!city || !g.address) {
                              g.setError("先有一座自己的城才能买卡");
                              return;
                            }
                            try {
                              g.setError("");
                              const paid = await g.payForCard(listing.seller, listing.winston, listing.cardId, listing.id, city.id);
                              g.addCommand(makeCommand({
                                kind: "buy_card",
                                label: `买卡 ${card?.name || ""}`,
                                listingId: listing.id,
                                cityId: city.id,
                                cardId: listing.cardId,
                                payTx: paid.payTx,
                                burnTx: paid.burnTx,
                                feeTx: paid.burnTx,
                                priceWinston: listing.winston,
                              }));
                              setModal("none");
                            } catch (e) {
                              g.setError(e instanceof Error ? e.message : String(e));
                            }
                          }}>用 AR 购买</button>
                        )}
                      </div>
                    )) : <p className="muted">{t("emptyMarket")}</p>}
                  </div>
                </div>
              </>
            ) : null}

            {modal === "guild" ? (
              <>
                <h3>{t("guildTitle")}</h3>
                <p className="muted">{t("guildHint")}</p>
                <input className="board-search" value={boardQ} onChange={(e) => setBoardQ(e.target.value)} placeholder={t("guildSearch")} />
                <div className="board-cats">
                  {([["all", "catAll"], ["mine", "catMine"], ["join", "catJoin"], ["big", "catBig"]] as [BoardCat, "catAll" | "catMine" | "catJoin" | "catBig"][]).map(([id, key]) => (
                    <button key={id} className={`btn tiny${boardCat === id ? " primary" : ""}`} onClick={() => setBoardCat(id)}>{t(key)}</button>
                  ))}
                </div>
                <div className="board-body">
                  {myGuild ? (
                    <div className="card">
                      <div>{myGuild.name}<small>会长 {shortAddr(myGuild.leader)} · {myGuild.members.length} 人</small></div>
                      <button className="btn tiny" onClick={() => {
                        g.addCommand(makeCommand({ kind: "leave_guild", label: `退出公会 ${myGuild.name}` }));
                        setModal("none");
                      }}>退出公会</button>
                    </div>
                  ) : (
                    <div className="row">
                      {g.address && (sim.guildBanUntil?.[g.address] || 0) > g.now ? (
                        <p className="err">禁入期至 {new Date(sim.guildBanUntil[g.address]).toLocaleString()}</p>
                      ) : null}
                      <input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="新公会名" />
                      <button className="btn primary" onClick={() => {
                        g.addCommand(makeCommand({ kind: "create_guild", label: `建立公会 ${guildName}`, name: guildName }));
                        setModal("none");
                      }}>建立公会</button>
                    </div>
                  )}
                  <div className="board-grid" style={{ marginTop: 10 }}>
                    {filteredGuilds.length ? filteredGuilds.map((guild) => (
                      <div className="card" key={guild.id}>
                        <div>{guild.name}<small>{guild.members.length} 人 · 会长 {shortAddr(guild.leader)}</small></div>
                        {guild.id === myGuildId ? <span className="muted">已加入</span> : (
                          <button className="btn tiny" onClick={() => {
                            g.addCommand(makeCommand({ kind: "join_guild", label: `加入 ${guild.name}`, guildId: guild.id }));
                            setModal("none");
                          }}>加入</button>
                        )}
                      </div>
                    )) : <p className="muted">{t("emptyGuild")}</p>}
                  </div>
                </div>
              </>
            ) : null}

            {modal === "reports" ? (
              <>
                <h3>{t("reportsTitle")}</h3>
                <p className="muted">{t("reportsHint")}</p>
                <input className="board-search" value={boardQ} onChange={(e) => setBoardQ(e.target.value)} placeholder={t("reportsSearch")} />
                <div className="board-cats">
                  {([["all", "catAll"], ["win", "catWin"], ["lose", "catLose"], ["fight", "catFight"], ["scout", "catScout"], ["colonize", "catColonize"], ["reinforce", "catReinforce"]] as [BoardCat, "catAll" | "catWin" | "catLose" | "catFight" | "catScout" | "catColonize" | "catReinforce"][]).map(([id, key]) => (
                    <button key={id} className={`btn tiny${boardCat === id ? " primary" : ""}`} onClick={() => setBoardCat(id)}>{t(key)}</button>
                  ))}
                </div>
                <div className="board-body">
                  {filteredReports.length ? filteredReports.map((r) => (
                    <article key={r.id} className="report">
                      <h4>{r.win ? "成" : "败"} · {r.title} ({r.x},{r.y})</h4>
                      <p className="muted">{new Date(r.time).toLocaleString()}{r.aftermath ? ` · ${MISSION_NAME[r.aftermath]}` : ""}</p>
                      {(r.rounds || []).map((round, i) => <p key={i}><b>{round.title}</b> {round.text}</p>)}
                      {r.slaves || r.supplies ? <p>缴获奴隶 {r.slaves || 0} · 物资 {r.supplies || 0}</p> : null}
                      {r.deadNames?.length ? <p className="err">阵亡：{r.deadNames.join("、")}</p> : null}
                    </article>
                  )) : <p className="muted">{mineReports.length ? t("emptyReports") : t("emptyReportsNone")}</p>}
                </div>
              </>
            ) : null}

            {modal === "help" ? <HelpBoard q={boardQ} onQ={setBoardQ} /> : null}

            {modal === "atlas" ? (
              <>
                <h3>{t("atlasTitle")}</h3>
                <p className="muted">{t("atlasHint")}</p>
                <input className="board-search" value={boardQ} onChange={(e) => setBoardQ(e.target.value)} placeholder={t("atlasSearch")} />
                <div className="board-atlas">
                  <div className="board-atlas-list">
                    {atlasHits.map((hit) => (
                      <button key={`${hit.cx}:${hit.cy}:${hit.label}`} className={`btn tiny${hit.cx === g.chart.cx && hit.cy === g.chart.cy ? " primary" : ""}`} onClick={() => {
                        g.enterChart(hit.cx, hit.cy);
                        setInside(false);
                      }}>{hit.label}</button>
                    ))}
                  </div>
                  <AtlasCanvas
                    chart={g.chart}
                    cities={rosterCities.map((c) => ({ x: c.x, y: c.y, mine: true }))}
                    onEnter={(cx, cy) => { g.enterChart(cx, cy); setInside(false); setModal("none"); }}
                  />
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="dock">
        <div>
          <div className="muted">联网指令：排队中 → 已上传 → 链上可查到才发送完毕。别人的地块不加载细目。进攻须清空路径上的聚落。</div>
          <div className="queue">
            {g.pending.length === 0 ? <div className="muted">空</div> : null}
            {g.pending.map((c) => (
              <div className="qitem" key={c.id}>
                <button className="btn tiny" onClick={() => g.removeCommand(c.id)}>撤</button>
                {c.label}
              </div>
            ))}
          </div>
          <div className="queue" style={{ marginTop: 8 }}>
            {g.batches.slice().reverse().slice(0, 5).map((b) => (
              <div className="qitem" key={b.key}>{statusLabel(b.status)}<div className="muted">{(b.txId || b.key).slice(0, 10)}</div></div>
            ))}
          </div>
        </div>
        <button className="btn primary" style={{ minWidth: 160 }} onClick={g.execute} disabled={!g.pending.length || Boolean(g.busy)}>
          执行指令
        </button>
      </footer>
    </div>
  );
}
