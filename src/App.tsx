import { useMemo, useRef, useState } from "react";
import { BUILDINGS, MISSION_NAME, ROLES, scaleTime, SUPPLY_PER_SLAVE } from "./engine/catalog";
import { cityIdAt, npcAt, terrainAt, tileName } from "./engine/map";
import { planPath } from "./engine/path";
import { empireTimeFactor, slaveCostFor, workersFor } from "./engine/site";
import { citizensOf, corridorBlocked, idleSlaves, idleSupply, idleWorkers, recruitCapOf, worksOf } from "./engine/simulate";
import { useGame } from "./hooks/useGame";
import { makeCommand, statusLabel } from "./lib/cmd";
import { arToWinston, winstonToAr } from "./lib/market";
import { shortAddr } from "./lib/wallet";
import { CityCanvas } from "./scene/CityCanvas";
import { WorldCanvas } from "./scene/WorldCanvas";
import type { BuildingId, MarchMission, RoleId } from "./types";

function remain(ms: number, now: number) {
  const s = Math.max(0, Math.ceil((ms - now) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}分${s % 60}秒` : `${s}秒`;
}

type Modal = "none" | "tile" | "city" | "recruit" | "squad" | "build" | "card" | "reports" | "market";

export function App() {
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

  const sim = g.sim;
  const city = g.activeCity;
  const mine = Boolean(city && g.address && city.owner === g.address);
  const here = city && mine
    ? Object.values(g.world.cards).filter((c) => c.owner === g.address && c.cityId === city.id && !c.marchId)
    : [];
  const people = here.filter((c) => c.kind === "person" || c.kind === "slave");
  const ships = here.filter((c) => c.kind === "ship");
  const slaves = here.filter((c) => c.kind === "slave");
  const goods = here.filter((c) => c.kind === "supply");
  const sel = g.selected;
  const selCity = sel ? sim.cities[cityIdAt(sel.x, sel.y)] : undefined;
  const ownSel = Boolean(selCity && g.address && selCity.owner === g.address);
  const selNpc = sel && !selCity ? npcAt(sel.x, sel.y) : null;
  const path = city && sel ? planPath(city.x, city.y, sel.x, sel.y, true) : null;
  const blocked = city && path?.ok && mission !== "scout"
    ? corridorBlocked(sim, path.tiles, g.address, sel!.x, sel!.y)
    : null;
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
  const busyBuild = Boolean(city && Object.values(city.buildings).some((b) => b?.job));
  const pendingBuild = g.pending.some((c) => c.kind === "upgrade" && c.cityId === city?.id);

  function toggle(id: string, list: string[], set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function enterOwnCity(id: string) {
    const c = sim.cities[id];
    if (!c || c.owner !== g.address) {
      setModal("tile");
      return;
    }
    g.setFocusCityId(id);
    g.setSelected({ x: c.x, y: c.y });
    setInside(true);
    setModal("none");
  }

  return (
    <div className="app app-3d">
      <header className="top">
        <div className="brand cinzel">
          <b>热血城邦</b>
          <span>完全免费 · 本地无需钱包 · 操作都在游戏里</span>
        </div>
        <label className="muted">
          <input type="radio" checked={g.mode === "local"} onChange={() => g.setMode("local")} /> 本地
        </label>
        <label className="muted">
          <input type="radio" checked={g.mode === "permabin"} onChange={() => g.setMode("permabin")} /> Permabin
        </label>
        {g.busy ? <span className="busy">{g.busy}</span> : null}
        {g.error ? <span className="err">{g.error}</span> : null}
        <div className="top-actions">
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) g.doImport(await f.text());
            e.target.value = "";
          }} />
          {g.mode === "local" ? (
            <span className="muted">{shortAddr(g.address)} · 本城 人{peopleN} 奴{slaveN} 物资{goods.length} 城{g.myCities.length} · 免费无需钱包</span>
          ) : g.address && !g.address.startsWith("local:") ? (
            <>
              <span className="muted">{shortAddr(g.address)} · 本城 人{peopleN} 奴{slaveN} 物资{goods.length} 城{g.myCities.length}</span>
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
            onBuilding={(id) => { setBuildId(id); setModal("build"); }}
            onCard={(id) => { setCardId(id); setModal("card"); }}
          />
        ) : (
          <WorldCanvas
            world={g.world}
            now={g.now}
            view={g.view}
            selected={g.selected}
            address={g.address}
            onSelect={(x, y) => { g.setSelected({ x, y }); g.setView({ x, y }); setModal("tile"); }}
            onView={(x, y) => g.setView({ x, y })}
            onEnterCity={enterOwnCity}
          />
        )}

        <div className="hud-float">
          <button className="btn tiny" onClick={() => setModal("reports")}>战报</button>
          <button className="btn tiny" onClick={() => setModal("market")}>货架</button>
          {mine ? <button className="btn tiny" onClick={() => { setInside(true); setModal("none"); }}>进入城市</button> : null}
          {inside ? <button className="btn tiny" onClick={() => setInside(false)}>回到大地图</button> : null}
          {inside && mine ? <button className="btn tiny" onClick={() => setModal("city")}>城内操作</button> : null}
          {incoming.length ? <span className="err">敌军逼近 {incoming.length} 支</span> : null}
        </div>
      </div>

      {modal !== "none" ? (
        <div className="modal-back" onClick={() => setModal("none")}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn tiny modal-x" onClick={() => setModal("none")}>关闭</button>
            {modal === "tile" && sel ? (
              <>
                <h3>{sel.x},{sel.y} {tileName(terrainAt(sel.x, sel.y))}</h3>
                {selCity && ownSel ? (
                  <p>{selCity.name} · 宽{selCity.frontage} · 战{selCity.wars.length}</p>
                ) : selCity ? (
                  <p>此地不属于你，无法加载城内名册、建筑与奴隶。只能看见这里有一座{selCity.npc ? ` ${selCity.tribeLevel || 1}级固定聚落` : "城"}。</p>
                ) : selNpc ? (
                  <p>{selNpc.name} 固定在这格刷新，不会搬家。等级 {selNpc.level}。未攻下前看不到里面的人。</p>
                ) : (
                  <p>可建城的荒野。时间耗地形、城数、人物卡和奴隶卡。</p>
                )}
                {path?.ok ? <p className="muted">{path.naval ? "海路" : "陆路"} {path.dist} 格</p> : path && !path.ok ? <p className="err">{path.reason}</p> : null}
                {blocked ? <p className="err">{blocked}</p> : null}
                {!g.address ? <p>先创建钱包。</p> : null}
                {g.address && !city ? (
                  <>
                    <input value={cityName} onChange={(e) => setCityName(e.target.value)} />
                    <button className="btn primary" onClick={() => {
                      g.addCommand(makeCommand({ kind: "found_city", label: `建城 ${cityName} (${sel.x},${sel.y})`, x: sel.x, y: sel.y, name: cityName }));
                      setModal("none");
                    }}>加入建城指令</button>
                  </>
                ) : null}
                {ownSel ? (
                  <button className="btn" onClick={() => enterOwnCity(selCity!.id)}>进入城市 3D</button>
                ) : null}
                {city && sel ? (
                  <div className="row">
                    <select value={mission} onChange={(e) => setMission(e.target.value as MarchMission)}>
                      {(Object.keys(MISSION_NAME) as MarchMission[]).map((m) => <option key={m} value={m}>{MISSION_NAME[m]}</option>)}
                    </select>
                    <button className="btn" onClick={() => setModal("squad")} disabled={Boolean(blocked) && mission !== "scout"}>编队出征</button>
                  </div>
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
                <h3>建造 · 占用资源</h3>
                {busyBuild || pendingBuild ? <p className="err">本城已有在建或已排队的工程，不能无限排。</p> : null}
                <p className="muted">空闲监工 {idleWorkers(sim, city.id, g.address).length} · 物资 {idleSupply(sim, city.id).length} · 可折奴隶 {idleSlaves(sim, city.id).length}</p>
                {(Object.keys(BUILDINGS) as BuildingId[]).map((bid) => {
                  const def = BUILDINGS[bid];
                  const lv = city.buildings[bid]?.level || 0;
                  const job = city.buildings[bid]?.job;
                  const cost = slaveCostFor(lv + 1);
                  const workers = workersFor(lv + 1);
                  const sec = scaleTime(def.baseTime, lv + 1, (city.buildMult[bid] || 1) * timeFactor);
                  return (
                    <div className="bld" key={bid}>
                      <div>
                        {def.name} {lv}级 · 料{cost} · 监工{workers} · 约{sec}秒
                        <div className="muted">{def.blurb}{job ? ` · 在建至${job.to}级 ${remain(job.finishAt, g.now)}` : ""}</div>
                      </div>
                      <button className="btn tiny" disabled={busyBuild || pendingBuild} onClick={() => {
                        g.addCommand(makeCommand({ kind: "upgrade", label: `建造 ${def.name}（料${cost}/监工${workers}）`, cityId: city.id, building: bid }));
                        setModal("none");
                      }}>加入指令</button>
                    </div>
                  );
                })}
              </>
            ) : null}

            {modal === "recruit" && city && mine ? (
              <>
                <h3>招募 上限 {recruitCapOf(city)}</h3>
                <p className="muted">奴隶不能招募。用 {SUPPLY_PER_SLAVE} 张本城物资买一张奴隶，或把奴隶转成公民。</p>
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
                {(Object.keys(ROLES) as RoleId[]).filter((r) => (ROLES[r].kind === "person" && r !== "citizen") || ROLES[r].kind === "ship").map((role) => (
                  <div className="card" key={role}>
                    <div>{ROLES[role].name}<small>{ROLES[role].blurb}</small></div>
                    <button className="btn tiny" onClick={() => {
                      g.addCommand(makeCommand({ kind: "recruit", label: `招募 ${ROLES[role].name}`, cityId: city.id, role }));
                      setModal("none");
                    }}>加入</button>
                  </div>
                ))}
              </>
            ) : null}

            {modal === "squad" && city && mine ? (
              <>
                <h3>编入军团（含奴隶，不含物资）</h3>
                {blocked && mission !== "scout" ? <p className="err">{blocked}</p> : null}
                {people.filter((c) => !c.jobId && !c.listedWinston).map((c) => (
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
                  <button className="btn primary" disabled={Boolean(blocked) && mission !== "scout"} onClick={() => {
                    g.addCommand(makeCommand({
                      kind: "march",
                      label: `${MISSION_NAME[mission]} → (${sel.x},${sel.y})`,
                      fromCityId: city.id,
                      cityId: city.id,
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
                <h3>人物卡货架</h3>
                <p className="muted">上架不收费。成交时付 AR：九成给卖家，一成打入手续费地址。付款上链后即使卖家再撤架也会过户。</p>
                {Object.values(sim.listings).map((listing) => {
                  const card = sim.cards[listing.cardId];
                  return (
                    <div className="card" key={listing.id}>
                      <div>
                        {card?.name || listing.cardId}
                        <small>{winstonToAr(listing.winston)} AR · {shortAddr(listing.seller)}</small>
                      </div>
                      {listing.seller === g.address ? (
                        <button className="btn tiny" onClick={() => {
                          g.addCommand(makeCommand({ kind: "delist_card", label: `撤架 ${card?.name || ""}`, listingId: listing.id }));
                        }}>撤架</button>
                      ) : (
                        <button className="btn tiny" onClick={async () => {
                          if (!city || !g.address) return;
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
                  );
                })}
              </>
            ) : null}

            {modal === "reports" ? (
              <>
                <h3>战报</h3>
                {sim.reports.slice(0, 12).map((r) => (
                  <article key={r.id} className="report">
                    <h4>{r.title} ({r.x},{r.y})</h4>
                    {r.rounds.slice(0, 4).map((round, i) => <p key={i}><b>{round.title}</b> {round.text}</p>)}
                    {r.deadNames.length ? <p className="muted">消失：{r.deadNames.join("、")}</p> : null}
                  </article>
                ))}
                {sim.skipped.slice(-5).map((s) => <p className="muted" key={s}>{s}</p>)}
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
