import { useCallback, useEffect, useMemo, useState } from "react";
import { foldHistory, playerCities, projectWorld } from "../engine/simulate";
import { veilWorld } from "../engine/veil";
import { loadChainState } from "../lib/chain";
import {
  drillFetch,
  drillUpload,
  drillWait,
  fetchSnapshot,
  newBatchKey,
  uploadBatch,
  waitUntilQueryable,
} from "../lib/permabin";
import { localProofs, payListing } from "../lib/market";
import { clearJwk, createWallet, exportWallet, importWallet, jwkAddress, loadJwk, loadOrCreateLocalId, type Jwk } from "../lib/wallet";
import type { Command, MarketPair, TrackedBatch, TxProof, WorldCheckpoint } from "../types";

export type PlayMode = "local" | "permabin";

export function useGame() {
  const [mode, setMode] = useState<PlayMode>("local");
  const [jwk, setJwk] = useState<Jwk | null>(null);
  const [localId] = useState(() => (typeof localStorage === "undefined" ? "local:guest" : loadOrCreateLocalId()));
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState<Command[]>([]);
  const [batches, setBatches] = useState<TrackedBatch[]>([]);
  const [checkpoint, setCheckpoint] = useState<WorldCheckpoint | null>(null);
  const [pairs, setPairs] = useState<MarketPair[]>([]);
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<{ x: number; y: number } | null>({ x: 0, y: 0 });
  const [focusCityId, setFocusCityId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setAddress(localId);
    const existing = loadJwk();
    if (!existing) return;
    setJwk(existing);
  }, [localId]);

  const setPlayMode = useCallback((next: PlayMode) => {
    setMode(next);
    setError("");
    if (next === "local") {
      setAddress(localId);
      return;
    }
    if (jwk) {
      jwkAddress(jwk).then(setAddress).catch(() => setError("本地钱包损坏，请重新导入"));
    } else {
      setAddress("");
    }
  }, [jwk, localId]);

  const load = useCallback(async () => {
    try {
      if (mode === "local") {
        setBatches((prev) => {
          const remote = drillFetch(address);
          const confirmed = new Map(remote.map((b) => [b.key, b]));
          const localOnly = prev.filter((b) => !confirmed.has(b.key) && (b.status === "queued" || b.status === "queued_uploaded" || b.status === "failed"));
          return [...remote, ...localOnly];
        });
        return;
      }
      const snap = await fetchSnapshot();
      const chain = await loadChainState(snap);
      setCheckpoint(chain.checkpoint);
      setPairs(chain.pairs);
      const remote = chain.batches;
      setBatches((prev) => {
        const confirmed = new Map(remote.map((b) => [b.txId || b.key, b]));
        const localOnly = prev.filter((b) => {
          const k = b.txId || b.key;
          return !confirmed.has(k) && (b.status === "queued" || b.status === "queued_uploaded" || b.status === "failed");
        });
        return [...remote, ...localOnly];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [mode, address]);

  useEffect(() => {
    load();
    const t = setInterval(load, mode === "local" ? 4000 : 15000);
    return () => clearInterval(t);
  }, [load, mode]);

  const folded = useMemo(
    () => foldHistory(batches, mode === "permabin" ? checkpoint : null, mode === "permabin" ? pairs : []),
    [batches, checkpoint, mode, pairs],
  );
  const sim = useMemo(() => projectWorld(folded, now, view.x, view.y), [folded, now, view.x, view.y]);
  const world = useMemo(() => veilWorld(sim, address, focusCityId), [sim, address, focusCityId]);
  const myCities = address ? playerCities(sim, address) : [];
  const activeCity = (focusCityId && sim.cities[focusCityId] && sim.cities[focusCityId].owner === address)
    ? sim.cities[focusCityId]
    : myCities[0] || null;

  useEffect(() => {
    if (!focusCityId && myCities[0]) {
      setFocusCityId(myCities[0].id);
      setView({ x: myCities[0].x, y: myCities[0].y });
    }
  }, [focusCityId, myCities]);

  const addCommand = useCallback((cmd: Command) => {
    setPending((p) => [...p, cmd]);
    setError("");
  }, []);

  const removeCommand = useCallback((id: string) => {
    setPending((p) => p.filter((c) => c.id !== id));
  }, []);

  const create = useCallback(async () => {
    setError("");
    try {
      const w = await createWallet();
      setJwk(w.jwk);
      setAddress(w.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const doImport = useCallback(async (text: string) => {
    setError("");
    try {
      const w = await importWallet(text);
      setJwk(w.jwk);
      setAddress(w.address);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const doExport = useCallback(() => {
    if (!jwk || !address) return;
    exportWallet(jwk, address);
  }, [jwk, address]);

  const logout = useCallback(() => {
    clearJwk();
    setJwk(null);
    setAddress("");
  }, []);

  const payForCard = useCallback(async (seller: string, winston: number, cardId: string, listingId: string, cityId: string) => {
    if (mode === "local") {
      if (!address) throw new Error("本地身份未就绪");
      return payListing({} as Jwk, address, seller, winston, cardId, listingId, true, cityId);
    }
    if (!jwk || !address) throw new Error("联网需要游戏内钱包，打开即可生成，不用插件、不用点签名");
    return payListing(jwk, address, seller, winston, cardId, listingId, false, cityId);
  }, [jwk, mode, address]);

  const execute = useCallback(async () => {
    if (!address) {
      setError(mode === "local" ? "本地身份未就绪" : "联网请先在游戏内创建钱包，无需插件或签名弹窗");
      return;
    }
    if (mode === "permabin" && !jwk) {
      setError("联网请先在游戏内创建或导入钱包");
      return;
    }
    if (!pending.length) {
      setError("指令列表为空");
      return;
    }
    setError("");
    const key = newBatchKey();
    const commands = [...pending];
    const proofs: Record<string, TxProof> = {};
    if (mode === "local") {
      for (const cmd of commands) {
        if (cmd.kind !== "buy_card" || !cmd.listingId) continue;
        const listing = sim.listings[cmd.listingId];
        if (!listing) continue;
        Object.assign(proofs, localProofs(address, listing.seller, listing.id, listing.winston, cmd.cityId || "").proofs);
      }
    }
    const tracked: TrackedBatch = {
      key,
      owner: address,
      signer: address,
      commands,
      clientTime: Date.now(),
      status: "queued",
      proofs,
    };
    setBatches((b) => [...b, tracked]);
    setPending([]);
    setBusy("排队中");
    try {
      const pack = {
        protocol: "permabin" as const,
        app: "Rexue-Chengbang",
        collection: "command-batches" as const,
        key,
        owner: address,
        clientTime: tracked.clientTime,
        commands,
      };
      const { txId } = mode === "local" ? await drillUpload(pack) : await uploadBatch(pack, jwk!);
      setBatches((bs) => bs.map((b) => (b.key === key ? { ...b, status: "queued_uploaded", txId } : b)));
      setBusy("排队中（已上传）");
      const confirmed = mode === "local" ? await drillWait(address, txId) : await waitUntilQueryable(txId);
      setBatches((bs) =>
        bs.map((b) =>
          b.key === key
            ? { ...b, status: "sent", txId, queryable: true, chainTime: confirmed.timestamp, proofs }
            : b,
        ),
      );
      setBusy("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBatches((bs) => bs.map((b) => (b.key === key ? { ...b, status: "failed", error: msg } : b)));
      setBusy("");
      setError(msg);
    }
  }, [address, jwk, mode, pending, sim.listings]);

  return {
    mode,
    setMode: setPlayMode,
    address,
    pending,
    batches,
    busy,
    now,
    view,
    setView,
    selected,
    setSelected,
    focusCityId,
    setFocusCityId,
    error,
    setError,
    world,
    sim,
    myCities,
    activeCity,
    addCommand,
    removeCommand,
    create,
    doImport,
    doExport,
    logout,
    execute,
    payForCard,
    load,
  };
}

export type GameApi = ReturnType<typeof useGame>;
