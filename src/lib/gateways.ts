import Arweave from "arweave";

/** Community AR.IO gateways, fastest first. */
export const FREE_GATEWAYS = [
  "https://ardrive.net",
  "https://turbo-gateway.com",
  "https://ar-io.dev",
  "https://frostor.xyz",
  "https://arweave.fllstck.dev",
  "https://zigza.xyz",
  "https://vilenarios.com",
] as const;

export const SEARCH_GQL = "https://arweave-search.goldsky.com/graphql";

const TIMEOUT_MS: Record<string, number> = {
  "ardrive.net": 2500,
  "turbo-gateway.com": 2800,
  "ar-io.dev": 3000,
  "frostor.xyz": 4500,
  "arweave.fllstck.dev": 4000,
  "zigza.xyz": 5000,
  "vilenarios.com": 9000,
};

let hotOrigin = "";
let hotGql = "";
let hotGqlAt = 0;

function envOrigin(): string {
  try {
    const vite = (import.meta as ImportMeta).env?.VITE_ARWEAVE_GATEWAY;
    if (vite) return vite.replace(/\/$/, "");
  } catch {
    /* node */
  }
  if (typeof process !== "undefined") {
    const v = process.env?.ARWEAVE_GATEWAY || process.env?.VITE_ARWEAVE_GATEWAY;
    if (v) return v.replace(/\/$/, "");
  }
  return "";
}

export function gatewayOrigins(): string[] {
  const extra = envOrigin();
  const list = extra && !FREE_GATEWAYS.includes(extra as (typeof FREE_GATEWAYS)[number])
    ? [extra, ...FREE_GATEWAYS]
    : [...FREE_GATEWAYS];
  if (hotOrigin) {
    const rest = list.filter((x) => x !== hotOrigin);
    return [hotOrigin, ...rest];
  }
  return list;
}

export function graphqlEndpoints(): string[] {
  const extra = envOrigin();
  const preferred = gatewayOrigins().map((g) => `${g}/graphql`);
  try {
    const vite = (import.meta as ImportMeta).env?.VITE_ARWEAVE_GQL;
    if (vite) preferred.unshift(vite);
  } catch {
    /* node */
  }
  if (typeof process !== "undefined" && process.env?.ARWEAVE_GQL) {
    preferred.unshift(process.env.ARWEAVE_GQL);
  }
  if (extra) preferred.unshift(`${extra}/graphql`);
  return [...new Set([...preferred, SEARCH_GQL])];
}

function timeoutFor(origin: string) {
  try {
    const host = new URL(origin).hostname;
    if (host.includes("goldsky")) return 8000;
    return TIMEOUT_MS[host] || 4000;
  } catch {
    return 4000;
  }
}

async function fetchTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export function arweaveClient(origin = gatewayOrigins()[0]) {
  const u = new URL(origin);
  return Arweave.init({
    host: u.hostname,
    port: u.port ? Number(u.port) : 443,
    protocol: u.protocol.replace(":", "") || "https",
  });
}

export async function fetchTxText(id: string): Promise<string> {
  let last = "";
  for (const origin of gatewayOrigins()) {
    try {
      const res = await fetchTimeout(`${origin}/${id}`, { cache: "no-store" }, timeoutFor(origin));
      if (!res.ok) {
        last = `${origin} HTTP ${res.status}`;
        continue;
      }
      hotOrigin = origin;
      return await res.text();
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`读取交易失败 ${id}${last ? ` (${last})` : ""}`);
}

export async function pickGraphql(): Promise<string> {
  if (hotGql && Date.now() - hotGqlAt < 60_000) return hotGql;
  const preferred = graphqlEndpoints().filter((u) => u !== SEARCH_GQL);
  for (const url of preferred) {
    try {
      const res = await fetchTimeout(
        url,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: "{ transactions(first: 1) { edges { node { id } } } }" }),
        },
        timeoutFor(url),
      );
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.data?.transactions) {
        hotGql = url;
        hotGqlAt = Date.now();
        try {
          hotOrigin = new URL(url).origin;
        } catch {
          /* keep */
        }
        return url;
      }
    } catch {
      /* next */
    }
  }
  return SEARCH_GQL;
}

export async function postGraphql(url: string, body: unknown): Promise<Response> {
  const order = [...new Set([url, ...graphqlEndpoints()])];
  let last: Response | undefined;
  for (const gql of order) {
    try {
      const res = await fetchTimeout(
        gql,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        timeoutFor(gql),
      );
      if (res.ok) {
        if (gql !== SEARCH_GQL) {
          hotGql = gql;
          hotGqlAt = Date.now();
        }
        return res;
      }
      last = res;
    } catch {
      /* next */
    }
  }
  if (last) return last;
  throw new Error("GraphQL 网关全部超时");
}
