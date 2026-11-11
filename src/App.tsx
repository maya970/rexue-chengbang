import { useEffect, useMemo, useRef, useState } from "react";
import { BARE_BUILD_MULT, BUILDINGS, COLONIZE_COST, MISSION_NAME, PLOT_NAME, PLOT_TIME, ROLES, scaleTime, SUPPLY_PER_SLAVE } from "./engine/catalog";
import { canFoundVillage, childrenOf, cityLevelCap, hamletLabel, hamletOf, inCityRealm, isHamlet, linkedChildrenOf, seatCity, SITE_UPGRADE } from "./engine/hamlets";
import { canColonize, chartName, chartOf, cityIdAt, npcAt, terrainAt, tileName } from "./engine/map";
import { planPath } from "./engine/path";
import { canBuildOn, plotTimeMult } from "./engine/plots";
import { copiesOf, highestLevel, plotJobs, workLevel } from "./engine/works";
import { empireTimeFactor, slaveCostFor, workersFor } from "./engine/site";
import { claimOwner, claimsGap, isAllyClaim, isClaimed } from "./engine/realm";
import { alliesOf, buildSlotsOf, citizensOf, corridorBlocked, homeOf, idleSlaves, idleSupply, idleWorkers, recruitCapOf, roleCapOf, roleCountOf, worksOf } from "./engine/simulate";
import { loadInbox, mergeInbox } from "./lib/inbox";
import { HelpBoard } from "./i18n/HelpBoard";
import { LangSelect, useI18n } from "./i18n";
import { formatReport, playerWon, reportHay } from "./i18n/report";
import { useGame } from "./hooks/useGame";
import { makeCommand, statusLabel } from "./lib/cmd";
import { shortAddr } from "./lib/wallet";
import { sendCam } from "./lib/cam";
import { AtlasCanvas } from "./scene/AtlasCanvas";
import { CityCanvas } from "./scene/CityCanvas";
import { EmpireHud } from "./scene/EmpireHud";
import { Gate } from "./scene/Gate";
import { WorldCanvas } from "./scene/WorldCanvas";
import type { BuildingId, MarchMission, RoleId } from "./types";

function remain(ms: number, now: number) {
  const s = Math.max(0, Math.ceil((ms - now) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`;
}

type Modal = "none" | "tile" | "city" | "recruit" | "squad" | "build" | "card" | "reports" | "guild" | "atlas" | "help";
type RosterTab = "cities" | "people" | "slaves" | "goods" | "marches";
type BoardCat = "all" | "win" | "lose" | "scout" | "colonize" | "fight" | "reinforce" | "mine" | "join" | "big";
type DrawerId = "none" | "menu" | "stock" | "roster" | "queue" | "view";

function hay(parts: (string | number | undefined)[]) {
  return parts.filter((x) => x !== undefined).join(" ").toLowerCase();
}

export function App() {
  const { t, locale } = useI18n();
  const g = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<Modal>("none");
  const [inside, setInside] = useState(false);
  const [pickedP, setPickedP] = useState<string[]>([]);
  const [pickedS, setPickedS] = useState<string[]>([]);
  const [cityName, setCityName] = useState("新城邦");
  const [renameDraft, setRenameDraft] = useState("");
  const [mission, setMission] = useState<MarchMission>("plunder");
  const [buildId, setBuildId] = useState<BuildingId>("oikos");
  const [cardId, setCardId] = useState<string>("");
  const [recruitQty, setRecruitQty] = useState<Partial<Record<RoleId, number>>>({});
  const [rosterOpen, setRosterOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerId>("none");

  function toggleDrawer(id: Exclude<DrawerId, "none">) {
    const next = drawer === id ? "none" : id;
    setDrawer(next);
    setStockOpen(next === "stock");
    setRosterOpen(next === "roster");
  }

  function closeDrawers() {
    setDrawer("none");
    setStockOpen(false);
    setRosterOpen(false);
  }
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
  useEffect(() => {
    if (city?.name) setRenameDraft(city.name);
  }, [city?.id, city?.name]);
  const origin = g.myCities.find((c) => c.id === fromCityId) || g.myCities[0] || null;
  const mine = Boolean(city && g.address && city.owner === g.address);
  const here = city && mine
    ? Object.values(sim.cards).filter((c) => c.owner === g.address && c.cityId === city.id && !c.marchId && !sim.fallen?.[c.id])
    : [];
  const originHere = origin && g.address
    ? Object.values(sim.cards).filter((c) => c.owner === g.address && c.cityId === origin.id && !c.marchId && !sim.fallen?.[c.id])
    : [];
  const people = here.filter((c) => c.kind === "person" || c.kind === "slave");
  const originPeople = originHere.filter((c) => c.kind === "person" || c.kind === "slave");
  const ships = (inside ? here : originHere).filter((c) => c.kind === "ship");
  const slaves = here.filter((c) => c.kind === "slave");
  const goods = here.filter((c) => c.kind === "supply");
  const sel = g.selected;
  const selCity = sel ? sim.cities[cityIdAt(sel.x, sel.y)] : undefined;
  const ownSel = Boolean(selCity && g.address && selCity.owner === g.address);
  const selNpc = sel && !selCity && !claimOwner(sim, sel.x, sel.y) ? npcAt(sel.x, sel.y) : null;
  const path = origin && sel ? planPath(origin.x, origin.y, sel.x, sel.y, true) : null;
  const blocked = origin && path?.ok
    ? corridorBlocked(sim, path.tiles, g.address, sel!.x, sel!.y)
    : null;
  const claimMiss = origin && path?.ok && sel && (mission === "colonize" || mission === "settle")
    ? claimsGap(sim, g.address, path.tiles, sel.x, sel.y)
    : null;
  const villageMiss = origin && sel && mission === "settle" ? canFoundVillage(sim, g.address, origin, sel.x, sel.y) : null;
  const seaColonize = Boolean(sel && (mission === "colonize" || mission === "settle") && !canColonize(terrainAt(sel.x, sel.y)));
  const warMission = mission === "plunder" || mission === "massacre" || mission === "destroy" || mission === "occupy";
  const friendlyFire = Boolean(selCity && g.address && warMission && alliesOf(sim, g.address).has(selCity.owner));
  const myGuildId = g.address ? sim.memberOf?.[g.address] : "";
  const myGuild = myGuildId ? sim.guilds?.[myGuildId] : undefined;
  const focusPlot = city?.plots?.find((p) => p.id === plotId);
  const seat = city ? seatCity(sim, city) : undefined;
  const peopleN = seat && mine ? Object.values(sim.cards).filter((c) => homeOf(c) === seat.id && c.kind === "person" && !sim.fallen?.[c.id]).length : 0;
  const slaveN = slaves.length;
  const timeFactor = empireTimeFactor(
    g.myCities.length,
    Object.values(sim.cards).filter((c) => c.owner === g.address && c.kind === "person").length,
    Object.values(sim.cards).filter((c) => c.owner === g.address && c.kind === "slave").length,
  );
  const focusCard = cardId && !sim.fallen?.[cardId] ? sim.cards[cardId] : undefined;
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
    closeDrawers();
    setModal("reports");
  }

  function openBoard(kind: "guild" | "atlas" | "help") {
    setBoardQ("");
    setBoardCat("all");
    closeDrawers();
    setModal(kind);
  }

  const boardModal = modal === "reports" || modal === "guild" || modal === "atlas" || modal === "help";

  const filteredReports = useMemo(() => {
    const q = boardQ.trim().toLowerCase();
    return mineReports.filter((r) => {
      if (boardCat === "win" && !playerWon(r, g.address)) return false;
      if (boardCat === "lose" && playerWon(r, g.address)) return false;
      if (boardCat === "scout" && r.code !== "scout" && r.aftermath !== "scout" && !r.title.includes("侦察") && !r.title.toLowerCase().includes("scout")) return false;
      if (boardCat === "colonize" && r.aftermath !== "colonize" && r.code !== "colonizeOk" && r.code !== "colonizeFail" && !r.title.includes("殖民")) return false;
      if (boardCat === "reinforce" && r.aftermath !== "reinforce" && r.code !== "reinforceOk" && r.code !== "reinforceBack" && !r.title.includes("增援")) return false;
      if (boardCat === "fight" && r.aftermath !== "plunder" && r.aftermath !== "massacre" && r.aftermath !== "occupy" && r.aftermath !== "destroy" && r.code !== "fieldWin" && r.code !== "fieldLose" && r.code !== "siegeWin" && r.code !== "siegeLose" && !r.title.includes("攻") && !r.title.includes("野")) return false;
      if (!q) return true;
      return hay([r.x, r.y, reportHay(locale, r), ...(r.deadNames || [])]).includes(q);
    });
  }, [mineReports, boardQ, boardCat, locale, g.address]);

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
  const busyJobs = city ? plotJobs(city).length : 0;
  const pendingBuild = g.pending.filter((c) => c.kind === "upgrade" && c.cityId === city?.id).length;
  const busyBuild = busyJobs + pendingBuild >= buildSlots;

  function toggle(id: string, list: string[], set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const myCards = useMemo(
    () => Object.values(sim.cards).filter((c) => c.owner === g.address && !sim.fallen?.[c.id]),
    [sim.cards, sim.fallen, g.address],
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
    closeDrawers();
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
    closeDrawers();
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

  if (g.booting || !g.address) {
    return <Gate booting={g.booting} error={g.error} onCreate={g.create} onImport={g.doImport} />;
  }

  return (
    <div className={`app app-3d${drawer !== "none" ? ` drawer-${drawer}` : ""}`}>
      <header className="top">
        <div className="drawer-tabs drawer-tabs-top" role="tablist">
          <button type="button" className={drawer === "menu" ? "on" : ""} onClick={() => toggleDrawer("menu")}>
            菜单{incoming.length ? ` ${incoming.length}` : ""}
          </button>
          <button type="button" className={drawer === "stock" ? "on" : ""} onClick={() => toggleDrawer("stock")}>库藏</button>
          <button type="button" className={drawer === "roster" ? "on" : ""} onClick={() => toggleDrawer("roster")}>名册</button>
          <button type="button" className="drawer-fold" onClick={closeDrawers} disabled={drawer === "none"}>收起</button>
        </div>
        <div className="chrome-body">
        <nav className="top-nav">
          {g.address ? (
            <button className={`btn tiny desk-dup${stockOpen ? " primary" : ""}`} onClick={() => toggleDrawer("stock")}>
              {stockOpen ? "收起库藏" : "库藏"}
            </button>
          ) : null}
          <button className="btn tiny" onClick={openReports}>
            {t("reports")}{unreadReports.length ? ` ${unreadReports.length}` : ""}
          </button>
          <button className="btn tiny" onClick={() => openBoard("guild")}>{t("guild")}</button>
          <button className="btn tiny" onClick={() => openBoard("atlas")}>{t("atlas")}</button>
          <button className="btn tiny" onClick={() => openBoard("help")}>{t("help")}</button>
          <LangSelect compact />
          <button className="btn tiny primary desk-dup" onClick={() => toggleDrawer("roster")}>
            {rosterOpen ? "收起名册" : "我的名册"}
          </button>
          {(g.myCities[0] || rosterCities[0]) && !inside ? (
            <button className="btn tiny" onClick={() => jumpCity((g.myCities[0] || rosterCities[0]).id)}>一键回城</button>
          ) : null}
          {mine && !inside ? <button className="btn tiny" onClick={() => { setInside(true); setModal("none"); }}>进入城市</button> : null}
          {inside ? <button className="btn tiny" onClick={() => setInside(false)}>回到大地图</button> : null}
          {inside && mine ? (
            <>
              <button className="btn tiny" onClick={() => setModal("city")}>城邦 / 改名</button>
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
              <span className="muted">{shortAddr(g.address)}</span>
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
        </div>
      </header>

      <div className="stage">
        {g.loadingWorld && !g.worldReady ? (
          <div className="boot-veil">
            <p>正在载入天下…</p>
            {g.error ? (
              <>
                <p className="err">{g.error}</p>
                <button className="btn tiny" type="button" onClick={() => void g.load(false)}>重试</button>
              </>
            ) : null}
          </div>
        ) : null}
        {drawer !== "none" ? <button type="button" className="drawer-scrim" aria-label="收起" onClick={closeDrawers} /> : null}
        {g.address && stockOpen ? (
          <EmpireHud
            address={g.address}
            city={mine ? city : undefined}
            world={sim}
            now={g.now}
            pending={g.pending}
            onOpenCity={() => { if (city && mine) setModal("city"); }}
          />
        ) : null}
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

      {rosterOpen ? (
          <aside className="map-menu">
            <div className="map-menu-head">
              <b>我的名册</b>
              <span className="muted">点一项才跳转，不铺在地图上</span>
              <button className="btn tiny" style={{ marginLeft: "auto" }} onClick={closeDrawers}>关闭</button>
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
                    <div>{c.name}<small>({c.x},{c.y}){sim.cities[c.id] ? ` · ${hamletLabel(hamletOf(sim.cities[c.id]))}` : ""}</small></div>
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
                    closeDrawers();
                  }}>
                    <div>{MISSION_NAME[m.mission]}<small>去 ({m.toX},{m.toY}) · {m.personIds.length} 人</small></div>
                    <button className="btn tiny">查找</button>
                  </div>
                )) : <p className="muted">没有在途军团。</p>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {toast ? (
        <button className="report-toast" onClick={openReports}>
          {(() => {
            const mail = formatReport(locale, toast, g.address);
            return (
              <>
                <b>{mail.toast}</b> {mail.badge} · {mail.stance} · {mail.title}
                {mail.loot ? ` · ${mail.loot}` : ""}
                {mail.dead ? ` · ${mail.dead}` : ""}
              </>
            );
          })()}
        </button>
      ) : null}

      {modal !== "none" ? (
        <div className="modal-back" onClick={() => setModal("none")}>
          <div className={`modal${boardModal ? " board" : ""}${modal === "atlas" ? " atlas-modal" : ""}`} onClick={(e) => e.stopPropagation()}>
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
                  <p>{selNpc.name} 等级 {selNpc.level}。{selNpc.kind === "pirates" ? "海上海盗，图标是海盗旗与船，不是陆地部落。" : "陆地野蛮人聚落，与玩家城邦不是同一套图标。"}须进攻清理才能连通。连通过的格子不再刷新；未连通处仍会刷并切断你的连通。</p>
                ) : (
                  <p>
                    {g.myCities.length
                      ? `必须从已连通邻格一格格推进，公会成员的连通可共享。路上的野蛮人要先打掉。连通过的格子不再刷新野蛮人；未连通处仍会刷，并可能切断你的连通。`
                      : terrainAt(sel.x, sel.y) === "sea"
                        ? "第一座城可以建在海域，建成海港城，自带港口、船厂和运输船。"
                        : terrainAt(sel.x, sel.y) === "mountain"
                          ? "第一座城可以建在山地。山城易守，没有港口，翻山行军更慢。"
                          : "第一座城：平原、森林、海岸、山地、海域都可以建。"}
                  </p>
                )}
                {g.address && sel ? (
                  <p className="muted">
                    {selCity
                      ? selCity.npc
                        ? (selCity.owner || "").includes("pirates")
                          ? "海盗船队：海上独立图标。须进攻清理才能连通，侦察不能夺格。"
                          : "野蛮人聚落：不是玩家城。须进攻占领或毁灭才能连通，侦察不能夺格。"
                        : isHamlet(selCity)
                        ? selCity.owner === g.address
                          ? "这是你的附属乡村，可增援驻军。要占地须进攻别人的乡村。"
                          : "敌方乡村：侦察会抢劫；占地请直接进攻占领。"
                        : "已有城邦，侦察只能探听，占地必须进攻。"
                      : terrainAt(sel.x, sel.y) === "sea"
                        ? "海域不能抢格，海路可过，不必连通海域格。"
                        : isClaimed(sim, g.address, sel.x, sel.y)
                          ? "此格已是你的连通，野蛮人不会在此刷新。"
                          : isAllyClaim(sim, g.address, sel.x, sel.y)
                            ? "公会成员已连通，你可共享，不必再抢。"
                            : claimOwner(sim, sel.x, sel.y)
                              ? "他人空地：须从你或公会的连通邻格侦察抢下。"
                              : "无主空地：须与已连通格子相邻，侦察一格格夺下。"}
                  </p>
                ) : null}
                {path?.ok ? <p className="muted">{path.naval ? "海路" : "陆路"} {path.dist} 格</p> : path && !path.ok ? <p className="err">{path.reason}</p> : null}
                {blocked ? <p className="err">{blocked}</p> : null}
                {claimMiss ? <p className="err">{claimMiss}</p> : null}
                {villageMiss ? <p className="err">{villageMiss}</p> : null}
                {seaColonize ? <p className="err">海域不能殖民，请选海岸或陆地。</p> : null}
                {friendlyFire ? <p className="err">{selCity?.owner === g.address ? "不能攻击自己的城。" : "不能攻击同公会成员。"}</p> : null}
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
                  <div className="row">
                    <button className="btn" onClick={() => enterOwnCity(selCity!.id)}>{isHamlet(selCity!) ? "进入乡村" : "进入城市"}</button>
                    <button className="btn primary" onClick={() => {
                      g.setFocusCityId(selCity!.id);
                      setRenameDraft(selCity!.name);
                      setModal("city");
                    }}>城邦详情 / 改名</button>
                  </div>
                ) : null}
                {origin && sel ? (
                  <>
                    <p>出征必须指定<strong>出发城邦</strong>和<strong>将士</strong>。点地块只是目标，不会自动派兵。</p>
                    <label className="muted">出发城邦或乡村
                      <select value={origin.id} onChange={(e) => {
                        setFromCityId(e.target.value);
                        g.setFocusCityId(e.target.value);
                      }}>
                        {g.myCities.map((c) => <option key={c.id} value={c.id}>{c.name} · {hamletLabel(hamletOf(c))} ({c.x},{c.y})</option>)}
                      </select>
                    </label>
                    <div className="row">
                      <select value={mission} onChange={(e) => setMission(e.target.value as MarchMission)}>
                        {(Object.keys(MISSION_NAME) as MarchMission[]).filter((m) => {
                          if (m === "destroy" && selCity?.systemRank) return false;
                          if ((m === "colonize" || m === "settle") && sel && !canColonize(terrainAt(sel.x, sel.y))) return false;
                          if (m === "colonize" && (selCity || (origin && isHamlet(origin)))) return false;
                          if (m === "settle" && (selCity || (origin && isHamlet(origin)))) return false;
                          if ((m === "plunder" || m === "massacre" || m === "destroy" || m === "occupy") && selCity && g.address && alliesOf(sim, g.address).has(selCity.owner)) return false;
                          return true;
                        }).map((m) => <option key={m} value={m}>{MISSION_NAME[m]}</option>)}
                      </select>
                      <button className="btn primary" onClick={() => setModal("squad")} disabled={Boolean(blocked) || Boolean(claimMiss) || Boolean(villageMiss) || seaColonize || friendlyFire}>挑选将士出征</button>
                    </div>
                    {mission === "scout" && selCity && isHamlet(selCity) && selCity.owner !== g.address ? (
                      <p className="err">侦察敌方乡村会抢劫该村，不能夺格。要占地请改占领或屠城。</p>
                    ) : null}
                    {mission === "scout" && selCity && !isHamlet(selCity) ? (
                      <p className="muted">侦察城邦只能探听驻军，不能夺格。</p>
                    ) : null}
                    {mission === "colonize" ? <p className="muted">开辟的是独立城邦，不是乡村。</p> : null}
                    {mission === "settle" ? <p className="muted">修建的是附属乡村，归 {origin.name} 所有，一圈圈外扩。</p> : null}
                    {mission === "reinforce" ? <p className="muted">增援可把军队驻进自己的城或乡村。编制仍算出发城，不会空出名额。</p> : null}
                    {mission === "scout" && !selCity ? (
                      <p className="muted">侦察只能夺与已连通邻接的空地。公会连通可共享。路上有野蛮人须先进攻清理。</p>
                    ) : null}
                    {mission === "occupy" || mission === "destroy" || mission === "massacre" || mission === "plunder" ? (
                      <p className="muted">须沿已连通格子推进。挡路的野蛮人、乡村要占领或毁灭，劫掠不能开路。要留下城请用占领或屠城。</p>
                    ) : null}
                    <p className="muted">当前从 {origin.name} 出发，此地可派 {originPeople.filter((c) => !c.jobId).length} 人。</p>
                  </>
                ) : null}
              </>
            ) : null}

            {modal === "city" && city && mine ? (
              <>
                <h3>{city.name} · {hamletLabel(hamletOf(city))} LV.{highestLevel(city, "acropolis") || 1}{city.peakLevel && city.peakLevel > (highestLevel(city, "acropolis") || 1) ? ` (曾${city.peakLevel})` : ""}</h3>
                <div className="row rename-row">
                  <input maxLength={16} value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} placeholder="城邦之名" />
                  <button className="btn primary" disabled={!renameDraft.trim() || renameDraft.trim() === city.name} onClick={() => {
                    const name = renameDraft.trim().slice(0, 16);
                    g.addCommand(makeCommand({ kind: "rename_city", cityId: city.id, name, label: `改名 ${city.name} → ${name}` }));
                    setModal("none");
                  }}>改名</button>
                </div>
                <p className="muted">改名写入指令队列，点底部「执行指令」后生效。限 16 字。</p>
                <p>公民 {citizensOf(seat || city, sim)} · 军队编制 {peopleN}/{recruitCapOf(seat || city)}（出征、驻村仍占所属城名额） · 成果 {worksOf(city, sim)} · 本城奴隶 {slaveN} · 物资 {goods.length}</p>
                {isHamlet(city) ? (
                  <p className="muted">
                    附属 {sim.cities[city.parentId || ""]?.name || "城邦"}。
                    {city.parentId && sim.cities[city.parentId] && !inCityRealm(sim, sim.cities[city.parentId], city)
                      ? "未与该城城域相连，不给主城加建筑上限。"
                      : "与城域相连：给主城每一座建筑提高可升等级，须在主城升级，不会直接加等级或编制。"}
                    {hamletOf(city) !== "urban"
                      ? `升格为${hamletLabel(SITE_UPGRADE[hamletOf(city) as "village" | "suburb"].to)}：物资 ${SITE_UPGRADE[hamletOf(city) as "village" | "suburb"].supplies}、奴隶 ${SITE_UPGRADE[hamletOf(city) as "village" | "suburb"].slaves}。`
                      : "已是城区，解锁最多。"}
                  </p>
                ) : (
                  <p className="muted">
                    主城每座建筑可升至 {cityLevelCap(sim, city)} 级（基础 4 + 相连乡村：村+4 / 郊+8 / 城+12）。乡村加的是上限，要在主城升级才生效。同种可多修；无物资也能建，有料工期短。
                    相连 {linkedChildrenOf(sim, city).length} 处
                    {childrenOf(sim, city.id).length > linkedChildrenOf(sim, city).length
                      ? `，另有 ${childrenOf(sim, city.id).length - linkedChildrenOf(sim, city).length} 处未相连不计上限`
                      : ""}
                    ：{linkedChildrenOf(sim, city).map((v) => `${hamletLabel(hamletOf(v))}`).join("、") || "无"}。
                    乡村必须一圈圈与城邦邻接；中间被拆或占走，外圈不再解锁。
                  </p>
                )}
                <div className="row">
                  <button className="btn" onClick={() => setModal("recruit")}>招募 / 买奴</button>
                  <button className="btn" onClick={() => setModal("squad")}>出征</button>
                  <button className="btn" onClick={() => setModal("build")}>建筑</button>
                  {isHamlet(city) && hamletOf(city) !== "urban" ? (
                    <button className="btn primary" onClick={() => {
                      const step = SITE_UPGRADE[hamletOf(city) as "village" | "suburb"];
                      g.addCommand(makeCommand({
                        kind: "upgrade_site",
                        cityId: city.id,
                        label: `升格 ${city.name} 为${hamletLabel(step.to)}`,
                      }));
                      setModal("none");
                    }}>升格为{hamletLabel(SITE_UPGRADE[hamletOf(city) as "village" | "suburb"].to)}</button>
                  ) : null}
                </div>
              </>
            ) : null}

            {modal === "build" && city && mine ? (
              <>
                <h3>建造 · 一块空地一座，同种可多座</h3>
                {busyBuild ? <p className="err">同时在建已满：市政广场允许 {buildSlots} 座（在建 {busyJobs}、已排队 {pendingBuild}）。</p> : null}
                {plotJobs(city).length ? (
                  <div className="build-eta">
                    {plotJobs(city).map((p) => (
                      <div key={p.id}>
                        <b>{p.building ? BUILDINGS[p.building].name : "建筑"}</b> 升至 {p.job!.to} 级
                        {" · "}还剩 <em>{remain(p.job!.finishAt, g.now)}</em>
                      </div>
                    ))}
                  </div>
                ) : <p className="muted">当前没有正在建造的队列。开工后顶部会显示剩余秒数。</p>}
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
                  if (focusPlot) return canBuildOn(bid, focusPlot.kind);
                  return copiesOf(city, bid).length > 0;
                }).map((bid) => {
                  const def = BUILDINGS[bid];
                  const here = focusPlot?.building === bid ? focusPlot : undefined;
                  const lv = here ? workLevel(here) : 0;
                  const n = copiesOf(city, bid).length;
                  const sum = city.buildings[bid]?.level || 0;
                  const job = here?.job;
                  const next = (here ? lv : 0) + 1;
                  const cost = slaveCostFor(next);
                  const workers = workersFor(next);
                  const sec = scaleTime(def.baseTime, next, plotTimeMult(city, bid, focusPlot) * timeFactor);
                  const haveMat = idleSupply(sim, city.id).length + idleSlaves(sim, city.id).length >= cost;
                  const upgrading = Boolean(here && here.building);
                  return (
                    <div className="bld" key={bid}>
                      <div>
                        {def.name}
                        {n ? ` · ${n}座合计${sum}级` : ""}
                        {here ? ` · 此座${lv}级` : ""}
                        {" · "}监工{workers} · {haveMat ? `耗料${cost}约${sec}秒` : `无料约${sec * BARE_BUILD_MULT}秒（有料约${sec}秒）`}
                        <div className={job ? "build-eta-line" : "muted"}>
                          {def.blurb}
                          {job ? ` · 在建至${job.to}级，剩余 ${remain(job.finishAt, g.now)}` : ""}
                        </div>
                      </div>
                      <button className="btn tiny" disabled={busyBuild || !focusPlot || Boolean(job)} onClick={() => {
                        g.addCommand(makeCommand({
                          kind: "upgrade",
                          label: `${upgrading ? "升级" : "修建"} ${def.name}（监工${workers}${haveMat ? `/料${cost}` : "/无料慢工"}）`,
                          cityId: city.id,
                          building: bid,
                          plotId: focusPlot?.id,
                        }));
                        setModal("none");
                      }}>{upgrading ? "升级此座" : "在此空地建造"}</button>
                    </div>
                  );
                })}
              </>
            ) : null}

            {modal === "recruit" && city && mine ? (
              <>
                <h3>招募 总上限 {recruitCapOf(seat || city)} · 已有编制 {peopleN}</h3>
                <p className="muted">编制算在所属城邦。乡村不另开军队，只给主城建筑加可升等级。出征、驻村仍占主城名额。奴隶不能招募。用 {SUPPLY_PER_SLAVE} 张物资买奴隶，或把奴隶转成公民。兵种上限看主城对应建筑合计等级。</p>
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
                  const room = cap === 99 ? 20 : Math.max(0, cap - have);
                  const qty = Math.max(1, Math.min(room || 1, recruitQty[role] || 1));
                  return (
                    <div className="card" key={role}>
                      <div>
                        {ROLES[role].name}
                        <small>{ROLES[role].blurb} · {have}/{cap === 99 ? "—" : cap}</small>
                      </div>
                      <div className="row">
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, room)}
                          value={qty}
                          disabled={room < 1}
                          onChange={(e) => setRecruitQty((prev) => ({ ...prev, [role]: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))}
                          style={{ width: 64 }}
                        />
                        <button className="btn tiny" disabled={room < 1} onClick={() => {
                          g.addCommand(makeCommand({
                            kind: "recruit",
                            label: `招募 ${ROLES[role].name} ×${qty}`,
                            cityId: city.id,
                            role,
                            count: qty,
                          }));
                          setModal("none");
                        }}>加入 {qty} 人</button>
                      </div>
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
                {seaColonize ? <p className="err">海域不能殖民，请选海岸或陆地。</p> : null}
                {friendlyFire ? <p className="err">{selCity?.owner === g.address ? "不能攻击自己的城。" : "不能攻击同公会成员。"}</p> : null}
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
                  <button className="btn primary" disabled={(Boolean(blocked) && mission !== "scout") || pickedP.length === 0 || seaColonize || friendlyFire || Boolean(villageMiss)} onClick={() => {
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
                <p className="muted">人物简介</p>
                <p>{ROLES[focusCard.role]?.name} · {focusCard.kind === "slave" ? "奴隶" : focusCard.kind === "supply" ? "物资" : "人物"} · {cityNameOf(focusCard.cityId)}</p>
                {ROLES[focusCard.role]?.blurb ? <p className="muted">{ROLES[focusCard.role].blurb}</p> : null}
                {focusCard.kind === "person" || focusCard.kind === "slave" ? (
                  <>
                    <p>作战履历 {focusCard.campaigns.length} 场（进攻、守城、野战都记入，不只记进攻）</p>
                    {focusCard.campaigns.length ? (
                      <ul className="bio-wars">
                        {focusCard.campaigns.slice().reverse().slice(0, 24).map((w) => (
                          <li key={w.id}>{w.name}{w.time ? ` · ${new Date(w.time).toLocaleString()}` : ""}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">尚未参加任何作战（出征进攻、守城、野外遭遇都会写在这里）。</p>
                    )}
                  </>
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
                  {filteredReports.length ? filteredReports.map((r) => {
                    const mail = formatReport(locale, r, g.address);
                    return (
                      <article key={r.id} className="report">
                        <h4>{mail.badge} · {mail.stance} · {mail.title} ({r.x},{r.y})</h4>
                        <p className="muted">{new Date(r.time).toLocaleString()}{mail.aftermath ? ` · ${mail.aftermath}` : ""}</p>
                        {mail.rounds.map((round, i) => <p key={i}><b>{round.title}</b> {round.text}</p>)}
                        {mail.loot ? <p>{mail.loot}</p> : null}
                        {mail.dead ? <p className="err">{mail.dead}</p> : null}
                      </article>
                    );
                  }) : <p className="muted">{mineReports.length ? t("emptyReports") : t("emptyReportsNone")}</p>}
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

      <section className="view-sheet">
        <div className="dock-head">
          <b>视野</b>
          <button type="button" className="btn tiny dock-close" onClick={closeDrawers}>收起</button>
        </div>
        <div className="view-cam">
          <button type="button" className="btn tiny" onClick={() => sendCam("out")}>－</button>
          <button type="button" className="btn tiny" onClick={() => sendCam("in")}>＋</button>
          <button type="button" className="btn tiny" onClick={() => sendCam("rotate")}>转视角</button>
          <button type="button" className="btn tiny" onClick={() => sendCam("reset")}>回正</button>
        </div>
        {!inside ? (
          <div className="view-cam">
            <button type="button" className="btn tiny" onClick={() => sendCam("terrain")}>地形</button>
            <button type="button" className="btn tiny" onClick={() => sendCam("claims")}>连通图</button>
            <button type="button" className="btn tiny" onClick={() => sendCam("realm")}>城域</button>
          </div>
        ) : null}
        <div className="view-cam">
          <span className="muted">{chartName(g.chart.cx, g.chart.cy)}</span>
          <button type="button" className="btn tiny" onClick={() => g.goChart(0, -1)}>北</button>
          <button type="button" className="btn tiny" onClick={() => g.goChart(0, 1)}>南</button>
          <button type="button" className="btn tiny" onClick={() => g.goChart(-1, 0)}>西</button>
          <button type="button" className="btn tiny" onClick={() => g.goChart(1, 0)}>东</button>
        </div>
        <div className="view-cam">
          {(g.myCities[0] || rosterCities[0]) && !inside ? (
            <button type="button" className="btn tiny" onClick={() => jumpCity((g.myCities[0] || rosterCities[0]).id)}>一键回城</button>
          ) : null}
          {mine && !inside ? <button type="button" className="btn tiny" onClick={() => { setInside(true); setModal("none"); closeDrawers(); }}>进入城市</button> : null}
          {inside ? <button type="button" className="btn tiny" onClick={() => setInside(false)}>回到大地图</button> : null}
        </div>
      </section>

      <footer className="dock">
        <div>
          <div className="dock-head">
            <b>联网指令</b>
            <button type="button" className="btn tiny dock-close" onClick={closeDrawers}>收起</button>
          </div>
          <div className="muted dock-hint">联网指令：排队中 → 已上传 → 链上可查到才发送完毕。别人的地块不加载细目。进攻须清空路径上的聚落。</div>
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

      <nav className="drawer-tabs drawer-tabs-bottom" role="tablist">
        <button type="button" className={drawer === "view" ? "on" : ""} onClick={() => toggleDrawer("view")}>地图</button>
        <button type="button" className={drawer === "queue" ? "on" : ""} onClick={() => toggleDrawer("queue")}>
          指令{g.pending.length ? ` ${g.pending.length}` : ""}
        </button>
        <button type="button" className="drawer-fold" onClick={closeDrawers} disabled={drawer === "none"}>收起</button>
      </nav>
    </div>
  );
}
