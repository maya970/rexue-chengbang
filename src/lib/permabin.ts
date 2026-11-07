import Arweave from "arweave";
import { APP_NAME, COLLECTION, PROTOCOL } from "../engine/catalog";
import type { CommandBatch, TrackedBatch } from "../types";
import { fetchBatchesFromGraphQL, fetchRecentBatchesFromGraphQL, fetchTxProofs, queryTx, type WorldSnapshot } from "./query";

const GATEWAY = import.meta.env.VITE_ARWEAVE_GATEWAY || "https://arweave.net";
const GQL = import.meta.env.VITE_ARWEAVE_GQL || `${GATEWAY}/graphql`;
const GQL_BACKUP = import.meta.env.VITE_ARWEAVE_GQL_BACKUP || "https://arweave-search.goldsky.com/graphql";

export const arweave = Arweave.init({
  host: new URL(GATEWAY).hostname,
  port: 443,
  protocol: "https",
});

export function batchToTags(batch: CommandBatch): { name: string; value: string }[] {
  return [
    { name: "Content-Type", value: "application/json" },
    { name: "Protocol", value: PROTOCOL },
    { name: "App-Name", value: APP_NAME },
    { name: "App-Version", value: "1.0.0" },
    { name: "Collection", value: COLLECTION },
    { name: "Permabin-Key", value: batch.key },
    { name: "Player", value: batch.owner },
    { name: "Type", value: "command-batch" },
  ];
}

export async function uploadBatch(batch: CommandBatch, jwk: Record<string, unknown>): Promise<{ txId: string }> {
  const body = JSON.stringify(batch);
  if (new TextEncoder().encode(body).length > 100 * 1024) {
    throw new Error("这一批指令超过免费 Permabin 的 100KiB 限额，请拆成更小的列表");
  }
  const { ArweaveSigner, createData } = await import("arbundles");
  const signer = new ArweaveSigner(jwk as never);
  const data = createData(body, signer, { tags: batchToTags(batch) });
  await data.sign(signer);
  const res = await fetch("https://upload.ardrive.io/v1/tx", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: data.getRaw(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Permabin 上传失败 HTTP ${res.status} ${text.slice(0, 180)}`);
  }
  const json = (await res.json().catch(() => ({ id: data.id }))) as { id?: string };
  return { txId: json.id || data.id };
}

export async function queryTxOnChain(txId: string): Promise<{ found: boolean; timestamp?: number }> {
  const a = await queryTx(GQL, txId);
  if (a.found) return a;
  return queryTx(GQL_BACKUP, txId).catch(() => ({ found: false }));
}

export async function waitUntilQueryable(
  txId: string,
  onTick?: (n: number) => void,
  timeoutMs = 180000,
): Promise<{ timestamp?: number }> {
  const start = Date.now();
  let n = 0;
  while (Date.now() - start < timeoutMs) {
    n += 1;
    onTick?.(n);
    const q = await queryTxOnChain(txId);
    if (q.found) return { timestamp: q.timestamp };
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error("链上查询超时，可稍后刷新。交易已提交。");
}

async function readTx(id: string): Promise<string> {
  const data = await arweave.transactions.getData(id, { decode: true, string: true });
  return String(data);
}

export async function fetchBatchesFromChain(): Promise<TrackedBatch[]> {
  return fetchBatchesFromGraphQL(GQL, readTx);
}

export async function fetchRecentBatches(sinceMs: number): Promise<TrackedBatch[]> {
  return fetchRecentBatchesFromGraphQL(GQL, readTx, sinceMs);
}

export async function attachPaymentProofs(batches: TrackedBatch[]): Promise<TrackedBatch[]> {
  const ids: string[] = [];
  for (const b of batches) {
    for (const c of b.commands) {
      if (c.payTx && !c.payTx.startsWith("local-")) ids.push(c.payTx);
      const feeId = c.feeTx || c.burnTx;
      if (feeId && !feeId.startsWith("local-")) ids.push(feeId);
    }
  }
  if (!ids.length) return batches;
  const fetched = await fetchTxProofs(GQL, ids);
  return batches.map((b) => {
    const proofs = { ...b.proofs };
    for (const c of b.commands) {
      if (c.payTx && fetched[c.payTx]) proofs[c.payTx] = fetched[c.payTx];
      const feeId = c.feeTx || c.burnTx;
      if (feeId && fetched[feeId]) proofs[feeId] = fetched[feeId];
    }
    return { ...b, proofs };
  });
}

export function worldIndexUrl(): string {
  if (import.meta.env.VITE_WORLD_INDEX_URL) return import.meta.env.VITE_WORLD_INDEX_URL;
  const repo = import.meta.env.VITE_GITHUB_REPO;
  if (repo) return `https://raw.githubusercontent.com/${repo}/world-index/snapshot.json`;
  return "";
}

export async function fetchSnapshot(): Promise<WorldSnapshot | null> {
  const url = worldIndexUrl();
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as WorldSnapshot;
  } catch {
    return null;
  }
}

export async function fetchIndexedBatches(): Promise<TrackedBatch[]> {
  const snap = await fetchSnapshot();
  if (!snap?.batches) return [];
  return snap.batches.map((b) => ({ ...b, status: "sent" as const, queryable: true }));
}

export function mergeBatches(a: TrackedBatch[], b: TrackedBatch[]): TrackedBatch[] {
  const map = new Map<string, TrackedBatch>();
  for (const row of [...a, ...b]) {
    const k = row.txId || row.key;
    const prev = map.get(k);
    if (!prev) map.set(k, row);
    else if ((row.chainTime || 0) >= (prev.chainTime || 0)) map.set(k, { ...prev, ...row });
  }
  return [...map.values()];
}

export function newBatchKey(): string {
  return `b${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
