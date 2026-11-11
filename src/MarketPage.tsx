import { useMemo, useRef, useState } from "react";
import { ROLES } from "./engine/catalog";
import { useI18n, LangSelect } from "./i18n";
import { useGame } from "./hooks/useGame";
import { makeCommand, statusLabel } from "./lib/cmd";
import { arToWinston, marketBucket, winstonToAr } from "./lib/market";
import { shortAddr } from "./lib/wallet";
import type { RoleId } from "./types";

type Cat = "all" | "mine" | "foot" | "bow" | "horse" | "navy" | "cheap";

function hay(parts: (string | number | undefined)[]) {
  return parts.filter((x) => x !== undefined).join(" ").toLowerCase();
}

export function MarketPage() {
  const { t } = useI18n();
  const g = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [listAr, setListAr] = useState("0.1");
  const [listId, setListId] = useState("");
  const sim = g.sim;
  const city = g.activeCity;
  const mine = Boolean(city && g.address && city.owner === g.address);

  const myPeople = useMemo(
    () => Object.values(sim.cards).filter((c) => c.owner === g.address && c.kind === "person" && !sim.fallen?.[c.id]),
    [sim.cards, sim.fallen, g.address],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = Object.values(sim.listings).map((listing) => ({ listing, card: sim.cards[listing.cardId] }));
    const next = list.filter(({ listing, card }) => {
      if (sim.fallen?.[listing.cardId]) return false;
      if (cat === "mine" && listing.seller !== g.address) return false;
      if (cat === "foot" || cat === "bow" || cat === "horse" || cat === "navy") {
        if (marketBucket(card?.role) !== cat) return false;
      }
      if (!needle) return true;
      return hay([card?.name, card?.role, card?.role ? ROLES[card.role].name : "", listing.seller, winstonToAr(listing.winston)]).includes(needle);
    });
    if (cat === "cheap") next.sort((a, b) => a.listing.winston - b.listing.winston);
    return next;
  }, [sim.listings, sim.cards, sim.fallen, q, cat, g.address]);

  const pick = myPeople.find((c) => c.id === listId) || myPeople.find((c) => !c.listedWinston && !c.marchId && !c.jobId);

  return (
    <div className="app market-page">
      <header className="top">
        <div className="brand cinzel">
          <b>人物卡货架</b>
          <span>独立交易页 · 上架免费 · 成交抽 10%</span>
        </div>
        <nav className="top-nav">
          <a className="btn tiny" href="#/">返回游戏</a>
          <LangSelect compact />
        </nav>
        <div className="top-actions">
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) g.doImport(await f.text());
            e.target.value = "";
          }} />
          {g.address ? (
            <>
              <span className="muted">{shortAddr(g.address)} · 城 {g.myCities.length}</span>
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

      <div className="market-layout">
        <section className="panel">
          <h3>上架自己的人物卡</h3>
          <p className="muted">游戏内已去掉上架入口。只在这一页上架、撤架。占用中或出征中的卡不能卖。</p>
          {!g.address ? <p>先创建钱包。</p> : null}
          {g.address && !myPeople.length ? <p className="muted">名册里还没有可卖的人物卡。</p> : null}
          {g.address && myPeople.length ? (
            <>
              <label className="muted">选择人物
                <select value={pick?.id || ""} onChange={(e) => setListId(e.target.value)}>
                  {myPeople.map((c) => (
                    <option key={c.id} value={c.id} disabled={Boolean(c.listedWinston || c.marchId || c.jobId)}>
                      {c.name} · {ROLES[c.role as RoleId]?.name} · {c.campaigns.length}战
                      {c.listedWinston ? " · 已上架" : ""}{c.marchId ? " · 出征" : ""}{c.jobId ? " · 监工" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                <input value={listAr} onChange={(e) => setListAr(e.target.value)} />
                <button className="btn primary" disabled={!pick || Boolean(pick.listedWinston || pick.marchId || pick.jobId)} onClick={() => {
                  if (!pick) return;
                  const winston = arToWinston(Number(listAr) || 0);
                  g.addCommand(makeCommand({
                    kind: "list_card",
                    label: `上架 ${pick.name}（定价 ${winstonToAr(winston)} AR，上架免费）`,
                    cardId: pick.id,
                    priceWinston: winston,
                  }));
                }}>上架（免费）</button>
              </div>
            </>
          ) : null}
        </section>

        <section className="panel">
          <h3>{t("marketTitle")}</h3>
          <p className="muted">{t("marketHint")}</p>
          <input className="board-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("marketSearch")} />
          <div className="board-cats">
            {([["all", "catAll"], ["mine", "catMine"], ["foot", "catFoot"], ["bow", "catBow"], ["horse", "catHorse"], ["navy", "catNavy"], ["cheap", "catCheap"]] as [Cat, "catAll" | "catMine" | "catFoot" | "catBow" | "catHorse" | "catNavy" | "catCheap"][]).map(([id, key]) => (
              <button key={id} className={`btn tiny${cat === id ? " primary" : ""}`} onClick={() => setCat(id)}>{t(key)}</button>
            ))}
          </div>
          <div className="board-body">
            <div className="board-grid">
              {rows.length ? rows.map(({ listing, card }) => (
                <div className="card" key={listing.id}>
                  <div>
                    {card?.name || listing.cardId}
                    <small>
                      {card?.role ? ROLES[card.role].name : "人物"} · {winstonToAr(listing.winston)} AR · {shortAddr(listing.seller)}
                      {card ? ` · 战历 ${card.campaigns.length}` : ""}
                    </small>
                  </div>
                  {listing.seller === g.address ? (
                    <button className="btn tiny" onClick={() => {
                      g.addCommand(makeCommand({ kind: "delist_card", label: `撤架 ${card?.name || ""}`, listingId: listing.id }));
                    }}>撤架</button>
                  ) : (
                    <button className="btn tiny" onClick={async () => {
                      if (!city || !g.address || !mine) {
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
                      } catch (e) {
                        g.setError(e instanceof Error ? e.message : String(e));
                      }
                    }}>用 AR 购买</button>
                  )}
                </div>
              )) : <p className="muted">{t("emptyMarket")}</p>}
            </div>
          </div>
        </section>
      </div>

      {g.error ? <p className="err">{g.error}</p> : null}
      {g.busy ? <p className="busy">{g.busy}</p> : null}

      <footer className="dock">
        <div>
          <div className="muted">上架、撤架、购买都要点执行才会上链。阵亡人物不会出现在货架上。</div>
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
