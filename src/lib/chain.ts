import { foldHistory } from "../engine/simulate";
import type { MarketPair, TrackedBatch, TxProof, WorldCheckpoint } from "../types";
import { SEARCH_GQL, fetchTxText, pickGraphql } from "./gateways";
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

export const GQL_BACKUP = import.meta.env.VITE_ARWEAVE_GQL_BACKUP || SEARCH_GQL;

async function readData(id: string): Promise<string> {
  return fetchTxText(id);
}

async function gqlPair() {
  const primary = await pickGraphql();
  return { primary, backup: GQL_BACKUP };
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
  const { primary, backup } = await gqlPair();
  const first = await queryTx(primary, txId);
  if (first.found) return first;
  if (backup === primary) return { found: false };
  return queryTx(backup, txId).catch(() => ({ found: false }));
}

export async function loadChainState(snap: WorldSnapshot | null): Promise<{
  batches: TrackedBatch[];
  checkpoint: WorldCheckpoint | null;
  pairs: MarketPair[];
}> {
  const { primary, backup } = await gqlPair();
  const headsA = await fetchBatchHeads(primary).catch(() => []);
  const headsB = await fetchBatchHeads(backup).catch(() => []);
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
    const fullA = await fetchBatchesFromGraphQL(primary, readData).catch(() => [] as TrackedBatch[]);
    const fullB = await fetchBatchesFromGraphQL(backup, readData).catch(() => [] as TrackedBatch[]);
    indexed = intersectBatches(fullA, fullB);
    checkpoint = null;
  }

  const overlapFrom = (checkpoint?.lastTime || snap?.generatedAt || Date.now()) - 600000;
  const recentA = await fetchRecentBatchesFromGraphQL(primary, readData, overlapFrom).catch(() => [] as TrackedBatch[]);
  const recentB = await fetchRecentBatchesFromGraphQL(backup, readData, overlapFrom).catch(() => [] as TrackedBatch[]);
  const recent = intersectBatches(recentA, recentB);

  const merged = mergeById(indexed, recent);
  const payIds = merged.flatMap((b) => b.commands.flatMap((c) => [c.payTx, c.feeTx || c.burnTx].filter(Boolean) as string[]));
  const proofsA = await fetchTxProofs(primary, payIds).catch(() => ({} as Record<string, TxProof>));
  const proofsB = await fetchTxProofs(backup, payIds).catch(() => ({} as Record<string, TxProof>));
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

  const mA = await fetchMarketTransfers(primary).catch(() => [] as TxProof[]);
  const mB = await fetchMarketTransfers(backup).catch(() => [] as TxProof[]);
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
