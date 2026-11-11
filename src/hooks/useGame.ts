import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chartCenter, chartOf } from "../engine/map";
import { foldHistory, playerCities, projectWorld } from "../engine/simulate";
import { veilWorld } from "../engine/veil";
import { loadChainState } from "../lib/chain";
import { loadNetworkGateways } from "../lib/gateways";
import {
  fetchSnapshot,
  newBatchKey,
  uploadBatch,
  waitUntilQueryable,
} from "../lib/permabin";
import { payListing } from "../lib/market";
import { commandSetFinger } from "../lib/cmd";
import { clearJwk, createWallet, exportWallet, importWallet, jwkAddress, loadJwk, type Jwk } from "../lib/wallet";
import type { Command, MarketPair, TrackedBatch, WorldCheckpoint } from "../types";

export function useGame() {
  const [jwk, setJwk] = useState<Jwk | null>(null);
  const [address, setAddress] = useState("");
  const [booting, setBooting] = useState(true);
  const [worldReady, setWorldReady] = useState(false);
  const [loadingWorld, setLoadingWorld] = useState(false);
  const [pending, setPending] = useState<Command[]>([]);
  const [batches, setBatches] = useState<TrackedBatch[]>([]);
  const [checkpoint, setCheckpoint] = useState<WorldCheckpoint | null>(null);
  const [pairs, setPairs] = useState<MarketPair[]>([]);
  const [busy, setBusy] = useState("");
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState(() => chartCenter(0, 0));
  const [chart, setChart] = useState({ cx: 0, cy: 0 });
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(() => chartCenter(0, 0));
  const [focusCityId, setFocusCityId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sendingRef = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const existing = loadJwk();
    if (!existing) {
      setBooting(false);
      return;
    }
    setJwk(existing);
    jwkAddress(existing)
      .then(setAddress)
      .catch(() => setError("本地钱包损坏，请重新导入"))
      .finally(() => setBooting(false));
  }, []);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingWorld(true);
    try {
      await loadNetworkGateways().catch(() => undefined);
      const snap = await fetchSnapshot();
      const chain = await loadChainState(snap);
      setCheckpoint(chain.checkpoint);
      setPairs(chain.pairs);
      const remote = chain.batches;
      setBatches((prev) => {
        const confirmed = new Map(remote.map((b) => [b.txId || b.key, b]));
        const localOnly = prev.filter((b) => {
          const k = b.txId || b.key;
          if (confirmed.has(k) || (b.txId && confirmed.has(b.txId))) return false;
          return b.status === "queued" || b.status === "queued_uploaded" || b.status === "sent" || b.status === "failed";
        });
        return [...remote, ...localOnly];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!quiet) setLoadingWorld(false);
      setWorldReady(true);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const t = setInterval(() => { void load(true); }, 15000);
    return () => clearInterval(t);
  }, [load]);

  const foldInput = useMemo(() => {
    if (!pending.length || !address) return batches;
    return [
      ...batches,
      {
        key: `pending:${address}`,
        owner: address,
        signer: address,
        commands: pending,
        clientTime: pending[0] ? Date.now() : 0,
        status: "queued" as const,
        proofs: {},
      },
    ];
  }, [batches, pending, address]);
  const folded = useMemo(() => foldHistory(foldInput, checkpoint, pairs), [foldInput, checkpoint, pairs]);
  const sim = useMemo(() => projectWorld(folded, now, view.x, view.y), [folded, now, view.x, view.y]);
  const world = useMemo(() => veilWorld(sim, address, focusCityId), [sim, address, focusCityId]);
  const myCities = address ? playerCities(sim, address) : [];
  const activeCity = (focusCityId && sim.cities[focusCityId] && sim.cities[focusCityId].owner === address)
    ? sim.cities[focusCityId]
    : myCities[0] || null;

  const enterChart = useCallback((cx: number, cy: number, at?: { x: number; y: number }) => {
    setChart({ cx, cy });
    const mid = at || chartCenter(cx, cy);
    setView(mid);
    setSelected(mid);
  }, []);

  const goChart = useCallback((dcx: number, dcy: number) => {
    setChart((cur) => {
      const next = { cx: cur.cx + dcx, cy: cur.cy + dcy };
      const mid = chartCenter(next.cx, next.cy);
      setView(mid);
      setSelected(mid);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!focusCityId && myCities[0]) {
      setFocusCityId(myCities[0].id);
      const c = chartOf(myCities[0].x, myCities[0].y);
      setChart(c);
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
    setWorldReady(false);
    setCheckpoint(null);
    setPending([]);
  }, []);

  const payForCard = useCallback(async (seller: string, winston: number, cardId: string, listingId: string, cityId: string) => {
    if (!jwk || !address) throw new Error("请先在游戏内创建钱包，无需插件或签名弹窗");
    return payListing(jwk, address, seller, winston, cardId, listingId, cityId);
  }, [jwk, address]);

  const pendingDup = useMemo(() => {
    if (!pending.length) return false;
    const finger = commandSetFinger(pending);
    return batches.some(
      (b) =>
        (b.status === "queued" || b.status === "queued_uploaded") &&
        commandSetFinger(b.commands) === finger,
    );
  }, [pending, batches]);

  const execute = useCallback(async () => {
    if (!address || !jwk) {
      setError("请先在游戏内创建或导入钱包，无需插件或签名弹窗");
      return;
    }
    if (!pending.length) {
      setError("指令列表为空");
      return;
    }
    const finger = commandSetFinger(pending);
    const dup = batches.some(
      (b) =>
        (b.status === "queued" || b.status === "queued_uploaded") &&
        commandSetFinger(b.commands) === finger,
    );
    if (dup) {
      setError("这批指令正在发送，不必重复执行");
      return;
    }
    setError("");
    const key = newBatchKey();
    const commands = [...pending];
    const tracked: TrackedBatch = {
      key,
      owner: address,
      signer: address,
      commands,
      clientTime: Date.now(),
      status: "queued",
      proofs: {},
    };
    setBatches((b) => [...b, tracked]);
    setPending([]);
    sendingRef.current += 1;
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
      const { txId } = await uploadBatch(pack, jwk);
      setBatches((bs) => bs.map((b) => (b.key === key ? { ...b, status: "queued_uploaded", txId } : b)));
      if (sendingRef.current > 0) setBusy("排队中（已上传）");
      const confirmed = await waitUntilQueryable(txId);
      setBatches((bs) =>
        bs.map((b) =>
          b.key === key
            ? { ...b, status: "sent", txId, queryable: true, chainTime: confirmed.timestamp }
            : b,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBatches((bs) => bs.map((b) => (b.key === key ? { ...b, status: "failed", error: msg } : b)));
      setError(msg);
    } finally {
      sendingRef.current = Math.max(0, sendingRef.current - 1);
      setBusy(sendingRef.current > 0 ? "排队中" : "");
    }
  }, [address, jwk, pending, batches]);

  return {
    booting,
    worldReady,
    loadingWorld,
    address,
    pending,
    batches,
    busy,
    now,
    view,
    setView,
    chart,
    enterChart,
    goChart,
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
    pendingDup,
    execute,
    payForCard,
    load,
  };
}

export type GameApi = ReturnType<typeof useGame>;
