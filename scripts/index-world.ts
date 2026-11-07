import { mkdirSync, writeFileSync } from "node:fs";
import { APP_NAME, PROTOCOL } from "../src/engine/catalog.ts";
import { foldHistory } from "../src/engine/simulate.ts";
import { fetchBatchesFromGraphQL, fetchMarketTransfers, fetchTxProofs, pairMarket, type WorldSnapshot } from "../src/lib/query.ts";

const GQL = process.env.ARWEAVE_GQL || "https://arweave.net/graphql";
const GATEWAY = process.env.ARWEAVE_GATEWAY || "https://arweave.net";

async function readData(id: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/${id}`);
  if (!res.ok) throw new Error(`读取交易失败 ${id} HTTP ${res.status}`);
  return res.text();
}

const raw = await fetchBatchesFromGraphQL(GQL, readData);
const payIds = raw.flatMap((b) => b.commands.flatMap((c) => [c.payTx, c.feeTx || c.burnTx].filter(Boolean) as string[]));
const proofs = await fetchTxProofs(GQL, payIds);
const batches = raw.map((b) => ({
  ...b,
  proofs: {
    ...Object.fromEntries(
      (b.commands || [])
        .flatMap((c) => [c.payTx, c.feeTx || c.burnTx].filter(Boolean).map((id) => [id as string, proofs[id as string]]))
        .filter(([, p]) => p),
    ),
  },
}));
const pairs = pairMarket(await fetchMarketTransfers(GQL));
const world = foldHistory(batches, null, pairs);
const last = [...batches].sort((a, b) => (a.chainTime || 0) - (b.chainTime || 0) || a.key.localeCompare(b.key)).at(-1);
const living = Object.values(world.cards);
const slimReports = world.reports.slice(0, 40);
const snap: WorldSnapshot = {
  protocol: PROTOCOL,
  app: APP_NAME,
  generatedAt: Date.now(),
  source: "github-actions",
  batches,
  skipped: world.skipped.slice(-40),
  reportCount: world.reports.length,
  cityCount: Object.keys(world.cities).length,
  livingPeople: living.filter((c) => c.kind !== "ship").length,
  livingShips: living.filter((c) => c.kind === "ship").length,
  checkpoint: last?.chainTime
    ? {
        lastKey: last.key,
        lastTime: last.chainTime,
        world: { ...world, reports: slimReports },
      }
    : undefined,
};

mkdirSync("indexer-out", { recursive: true });
writeFileSync("indexer-out/snapshot.json", JSON.stringify(snap));
writeFileSync(
  "indexer-out/README.md",
  `# 热血城邦公开索引\n\n检查点只保存 foldHistory 结果。客户端会核 digest，并用两个网关交叉核对交易号。\n\n- 生成时间：${new Date(snap.generatedAt).toISOString()}\n- 批次：${batches.length}\n- digest：${world.digest}\n`,
);

console.log(`indexed ${batches.length} batches digest ${world.digest}`);
