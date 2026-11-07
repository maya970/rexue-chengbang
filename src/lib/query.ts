import { APP_NAME, AR_FEE_ADDR, COLLECTION, PROTOCOL } from "../engine/catalog";
import type { CommandBatch, MarketPair, TrackedBatch, TxProof, WorldCheckpoint } from "../types";

function proofKind(type: string): TxProof["kind"] | undefined {
  if (type === "card-sale") return "sale";
  if (type === "card-fee" || type === "card-burn") return "fee";
  return undefined;
}

export async function fetchBatchesFromGraphQL(
  gql: string,
  readData: (txId: string) => Promise<string>,
): Promise<TrackedBatch[]> {
  const rows: TrackedBatch[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 12; page += 1) {
    const query = {
      query: `query($cursor: String) {
        transactions(
          tags: [
            { name: "Protocol", values: ["${PROTOCOL}"] }
            { name: "App-Name", values: ["${APP_NAME}"] }
            { name: "Collection", values: ["${COLLECTION}"] }
          ]
          first: 100
          after: $cursor
          sort: HEIGHT_ASC
        ) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node {
              id
              owner { address }
              block { timestamp }
            }
          }
        }
      }`,
      variables: { cursor },
    };
    const res = await fetch(gql, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) break;
    const json = await res.json();
    const edges = json?.data?.transactions?.edges || [];
    for (const edge of edges) {
      const id = edge.node.id as string;
      try {
        const data = await readData(id);
        const batch = JSON.parse(data) as CommandBatch;
        if (batch.protocol !== "permabin" || !Array.isArray(batch.commands)) continue;
        const signer = edge.node.owner.address as string;
        rows.push({
          key: batch.key,
          owner: signer,
          signer,
          commands: batch.commands,
          clientTime: batch.clientTime,
          status: "sent",
          txId: id,
          chainTime: edge.node.block?.timestamp ? edge.node.block.timestamp * 1000 : undefined,
          queryable: Boolean(edge.node.block?.timestamp),
        });
      } catch {
        /* skip malformed */
      }
    }
    if (!json?.data?.transactions?.pageInfo?.hasNextPage) break;
    cursor = edges[edges.length - 1]?.cursor || null;
    if (!cursor) break;
  }
  return rows;
}

/** Newest page only — overlap window so snapshot + live chain cannot drift without a second full scan. */
export async function fetchRecentBatchesFromGraphQL(
  gql: string,
  readData: (txId: string) => Promise<string>,
  sinceMs: number,
): Promise<TrackedBatch[]> {
  const query = {
    query: `query {
      transactions(
        tags: [
          { name: "Protocol", values: ["${PROTOCOL}"] }
          { name: "App-Name", values: ["${APP_NAME}"] }
          { name: "Collection", values: ["${COLLECTION}"] }
        ]
        first: 40
        sort: HEIGHT_DESC
      ) {
        edges {
          node {
            id
            owner { address }
            block { timestamp }
          }
        }
      }
    }`,
  };
  const res = await fetch(gql, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const edges = json?.data?.transactions?.edges || [];
  const rows: TrackedBatch[] = [];
  for (const edge of edges) {
    const ts = edge.node.block?.timestamp ? edge.node.block.timestamp * 1000 : 0;
    if (ts && ts < sinceMs) continue;
    const id = edge.node.id as string;
    try {
      const data = await readData(id);
      const batch = JSON.parse(data) as CommandBatch;
      if (batch.protocol !== "permabin" || !Array.isArray(batch.commands)) continue;
      const signer = edge.node.owner.address as string;
      rows.push({
        key: batch.key,
        owner: signer,
        signer,
        commands: batch.commands,
        clientTime: batch.clientTime,
        status: "sent",
        txId: id,
        chainTime: ts || undefined,
        queryable: Boolean(ts),
      });
    } catch {
      /* skip */
    }
  }
  return rows;
}

export async function queryTx(gql: string, txId: string): Promise<{ found: boolean; timestamp?: number }> {
  const query = {
    query: `query($ids: [ID!]!) {
      transactions(ids: $ids, first: 1) {
        edges { node { id block { timestamp height } } }
      }
    }`,
    variables: { ids: [txId] },
  };
  const res = await fetch(gql, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(query),
  });
  if (!res.ok) return { found: false };
  const json = await res.json();
  const node = json?.data?.transactions?.edges?.[0]?.node;
  if (!node?.id) return { found: false };
  const timestamp = node.block?.timestamp ? node.block.timestamp * 1000 : undefined;
  return { found: Boolean(timestamp), timestamp };
}

export async function fetchTxProofs(gql: string, ids: string[]): Promise<Record<string, TxProof>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out: Record<string, TxProof> = {};
  for (let i = 0; i < unique.length; i += 20) {
    const slice = unique.slice(i, i + 20);
    const query = {
      query: `query($ids: [ID!]!) {
        transactions(ids: $ids, first: 20) {
          edges {
            node {
              id
              owner { address }
              recipient
              quantity { winston }
              tags { name value }
            }
          }
        }
      }`,
      variables: { ids: slice },
    };
    const res = await fetch(gql, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) continue;
    const json = await res.json();
    for (const edge of json?.data?.transactions?.edges || []) {
      const node = edge.node;
      const tags = Object.fromEntries((node.tags || []).map((t: { name: string; value: string }) => [t.name, t.value]));
      const kind = proofKind(tags.Type || "");
      if (!kind) continue;
      out[node.id] = {
        id: node.id,
        from: node.owner.address,
        target: node.recipient || (kind === "fee" ? AR_FEE_ADDR : ""),
        winston: Number(node.quantity?.winston || 0),
        listingId: tags["Listing-Id"] || "",
        cityId: tags["City-Id"] || "",
        kind,
      };
    }
  }
  return out;
}

export async function fetchBatchHeads(gql: string, pages = 8): Promise<{ id: string; owner: string; time: number }[]> {
  const rows: { id: string; owner: string; time: number }[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < pages; page += 1) {
    const query = {
      query: `query($cursor: String) {
        transactions(
          tags: [
            { name: "Protocol", values: ["${PROTOCOL}"] }
            { name: "App-Name", values: ["${APP_NAME}"] }
            { name: "Collection", values: ["${COLLECTION}"] }
          ]
          first: 100
          after: $cursor
          sort: HEIGHT_ASC
        ) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node { id owner { address } block { timestamp } }
          }
        }
      }`,
      variables: { cursor },
    };
    const res = await fetch(gql, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) break;
    const json = await res.json();
    const edges = json?.data?.transactions?.edges || [];
    for (const edge of edges) {
      rows.push({
        id: edge.node.id,
        owner: edge.node.owner.address,
        time: edge.node.block?.timestamp ? edge.node.block.timestamp * 1000 : 0,
      });
    }
    if (!json?.data?.transactions?.pageInfo?.hasNextPage) break;
    cursor = edges[edges.length - 1]?.cursor || null;
    if (!cursor) break;
  }
  return rows;
}

export async function fetchMarketTransfers(gql: string): Promise<TxProof[]> {
  const types = ["card-sale", "card-fee"];
  const rows: TxProof[] = [];
  for (const type of types) {
    const query = {
      query: `query {
        transactions(
          tags: [
            { name: "App-Name", values: ["${APP_NAME}"] }
            { name: "Type", values: ["${type}"] }
          ]
          first: 50
          sort: HEIGHT_DESC
        ) {
          edges {
            node {
              id
              owner { address }
              recipient
              quantity { winston }
              tags { name value }
              block { timestamp }
            }
          }
        }
      }`,
    };
    const res = await fetch(gql, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
    });
    if (!res.ok) continue;
    const json = await res.json();
    for (const edge of json?.data?.transactions?.edges || []) {
      const node = edge.node;
      const tags = Object.fromEntries((node.tags || []).map((t: { name: string; value: string }) => [t.name, t.value]));
      const kind = proofKind(tags.Type || type);
      if (!kind) continue;
      rows.push({
        id: node.id,
        from: node.owner.address,
        target: node.recipient || (kind === "fee" ? AR_FEE_ADDR : ""),
        winston: Number(node.quantity?.winston || 0),
        listingId: tags["Listing-Id"] || "",
        cityId: tags["City-Id"] || "",
        time: node.block?.timestamp ? node.block.timestamp * 1000 : undefined,
        kind,
      });
    }
  }
  return rows;
}

export function pairMarket(rows: TxProof[]): MarketPair[] {
  const sales = rows.filter((r) => r.kind === "sale");
  const fees = rows.filter((r) => r.kind === "fee");
  const out: MarketPair[] = [];
  for (const pay of sales) {
    const fee = fees.find((f) => f.listingId === pay.listingId && f.from === pay.from);
    if (!fee || !pay.listingId) continue;
    const time = Math.max(pay.time || 0, fee.time || 0);
    if (!time) continue;
    out.push({
      listingId: pay.listingId,
      buyer: pay.from,
      cityId: pay.cityId || fee.cityId || "",
      pay,
      fee,
      time,
      key: `sale:${pay.id}`,
    });
  }
  return out;
}

export interface WorldSnapshot {
  protocol: string;
  app: string;
  generatedAt: number;
  source: string;
  batches: TrackedBatch[];
  skipped: string[];
  reportCount: number;
  cityCount: number;
  livingPeople: number;
  livingShips: number;
  checkpoint?: WorldCheckpoint;
}
