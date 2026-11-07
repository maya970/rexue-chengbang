import { foldHistory } from "../engine/simulate";
import type { MarketPair, TrackedBatch, TxProof, WorldCheckpoint } from "../types";
import {
  fetchBatchesFromGraphQL,
  fetchBatchHeads,
  fetchMarketTransfers,
  fetchRecentBatchesFromGraphQL,
  fetchTxProofs,
  pairMarket,
  queryTx,
  type WorldSnapshot,
} from "./query";

export const GQL_PRIMARY = import.meta.env.VITE_ARWEAVE_GQL || "https://arweave.net/graphql";
export const GQL_BACKUP = import.meta.env.VITE_ARWEAVE_GQL_BACKUP || "https://arweave-search.goldsky.com/graphql";
const GATEWAY = import.meta.env.VITE_ARWEAVE_GATEWAY || "https://arweave.net";

async function readData(id: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/${id}`);
  if (!res.ok) throw new Error(`读取交易失败 ${id}`);
  return res.text();
}

function intersectBatches(a: TrackedBatch[], b: TrackedBatch[]): TrackedBatch[] {
  if (!b.length) return a;
  if (!a.length) return b;
  const ids = new Set(b.map((x) => x.txId).filter(Boolean));
  return a.filter((x) => x.txId && ids.has(x.txId));
}

function intersectHeads(
  a: { id: string; owner: string; time: number }[],
  b: { id: string; owner: string; time: number }[],
): { id: string; owner: string; time: number }[] {
  if (!b.length) return a;
  if (!a.length) return b;
  const ids = new Set(b.map((x) => x.id));
  return a.filter((x) => ids.has(x.id));
}

export async function queryTxAgreed(txId: string): Promise<{ found: boolean; timestamp?: number }> {
  const first = await queryTx(GQL_PRIMARY, txId);
  if (first.found) return first;
  return queryTx(GQL_BACKUP, txId).catch(() => ({ found: false }));
}

export async function loadChainState(snap: WorldSnapshot | null): Promise<{
  batches: TrackedBatch[];
  checkpoint: WorldCheckpoint | null;
  pairs: MarketPair[];
}> {
  const headsA = await fetchBatchHeads(GQL_PRIMARY).catch(() => []);
  const headsB = await fetchBatchHeads(GQL_BACKUP).catch(() => []);
  const heads = intersectHeads(headsA, headsB);

  let checkpoint: WorldCheckpoint | null = snap?.checkpoint || null;
  let indexed: TrackedBatch[] = (snap?.batches || []).map((b) => ({ ...b, status: "sent" as const, queryable: true }));

  if (checkpoint && snap?.batches?.length) {
    const folded = foldHistory(indexed, null);
    if (folded.digest !== checkpoint.world.digest) checkpoint = null;
  }

  const indexedIds = new Set(indexed.map((b) => b.txId).filter(Boolean) as string[]);
  const missingOld = heads.some((h) => checkpoint && h.time && h.time <= checkpoint.lastTime && !indexedIds.has(h.id));
  if (!snap || missingOld || !checkpoint) {
    const fullA = await fetchBatchesFromGraphQL(GQL_PRIMARY, readData).catch(() => [] as TrackedBatch[]);
    const fullB = await fetchBatchesFromGraphQL(GQL_BACKUP, readData).catch(() => [] as TrackedBatch[]);
    indexed = intersectBatches(fullA, fullB);
    checkpoint = null;
  }

  const overlapFrom = (checkpoint?.lastTime || snap?.generatedAt || Date.now()) - 600000;
  const recentA = await fetchRecentBatchesFromGraphQL(GQL_PRIMARY, readData, overlapFrom).catch(() => [] as TrackedBatch[]);
  const recentB = await fetchRecentBatchesFromGraphQL(GQL_BACKUP, readData, overlapFrom).catch(() => [] as TrackedBatch[]);
  const recent = intersectBatches(recentA, recentB);

  const merged = mergeById(indexed, recent);
  const payIds = merged.flatMap((b) => b.commands.flatMap((c) => [c.payTx, c.feeTx || c.burnTx].filter(Boolean) as string[]));
  const proofsA = await fetchTxProofs(GQL_PRIMARY, payIds).catch(() => ({} as Record<string, TxProof>));
  const proofsB = await fetchTxProofs(GQL_BACKUP, payIds).catch(() => ({} as Record<string, TxProof>));
  const proofs = agreeProofs(proofsA, proofsB);

  const withProofs = merged.map((b) => {
    const p = { ...b.proofs };
    for (const c of b.commands) {
      if (c.payTx && proofs[c.payTx]) p[c.payTx] = proofs[c.payTx];
      const feeId = c.feeTx || c.burnTx;
      if (feeId && proofs[feeId]) p[feeId] = proofs[feeId];
    }
    return { ...b, proofs: p };
  });

  const mA = await fetchMarketTransfers(GQL_PRIMARY).catch(() => [] as TxProof[]);
  const mB = await fetchMarketTransfers(GQL_BACKUP).catch(() => [] as TxProof[]);
  const market = intersectProofs(mA, mB);
  return { batches: withProofs, checkpoint, pairs: pairMarket(market) };
}

function mergeById(a: TrackedBatch[], b: TrackedBatch[]): TrackedBatch[] {
  const map = new Map<string, TrackedBatch>();
  for (const row of [...a, ...b]) {
    const k = row.txId || row.key;
    const prev = map.get(k);
    if (!prev) map.set(k, row);
    else if ((row.chainTime || 0) >= (prev.chainTime || 0)) map.set(k, { ...prev, ...row });
  }
  return [...map.values()];
}

function agreeProofs(a: Record<string, TxProof>, b: Record<string, TxProof>): Record<string, TxProof> {
  if (!Object.keys(b).length) return a;
  const out: Record<string, TxProof> = {};
  for (const [id, p] of Object.entries(a)) {
    const q = b[id];
    if (!q) continue;
    if (q.from === p.from && q.target === p.target && q.winston === p.winston) out[id] = p;
  }
  return Object.keys(out).length ? out : a;
}

function intersectProofs(a: TxProof[], b: TxProof[]): TxProof[] {
  if (!b.length) return a;
  const ids = new Set(b.map((x) => x.id));
  return a.filter((x) => ids.has(x.id));
}
