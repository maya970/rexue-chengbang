import Arweave from "arweave";

const KEY = "rexue-chengbang-jwk";
const LOCAL_ID = "rexue-chengbang-local-id";
const arweave = Arweave.init({ host: "arweave.net", port: 443, protocol: "https" });

export type Jwk = Record<string, unknown>;

export async function jwkAddress(jwk: Jwk): Promise<string> {
  return arweave.wallets.jwkToAddress(jwk as unknown as Parameters<typeof arweave.wallets.jwkToAddress>[0]);
}

export function loadJwk(): Jwk | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Jwk;
  } catch {
    return null;
  }
}

export function saveJwk(jwk: Jwk) {
  localStorage.setItem(KEY, JSON.stringify(jwk));
}

export function clearJwk() {
  localStorage.removeItem(KEY);
}

export async function createWallet(): Promise<{ jwk: Jwk; address: string }> {
  const jwk = (await arweave.wallets.generate()) as unknown as Jwk;
  saveJwk(jwk);
  const address = await jwkAddress(jwk);
  return { jwk, address };
}

export async function importWallet(text: string): Promise<{ jwk: Jwk; address: string }> {
  const jwk = JSON.parse(text) as Jwk;
  if (!jwk || typeof jwk !== "object" || !("kty" in jwk)) throw new Error("不是有效的钱包文件");
  saveJwk(jwk);
  return { jwk, address: await jwkAddress(jwk) };
}

export function exportWallet(jwk: Jwk, address: string) {
  const blob = new Blob([JSON.stringify(jwk, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rexue-chengbang-${address.slice(0, 8)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.startsWith("npc:")) return addr.replace("npc:", "蛮族·");
  if (addr.startsWith("local:")) return `本地·${addr.slice(6, 10)}`;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isLocalPlayer(addr: string): boolean {
  return addr.startsWith("local:");
}

/** 本地模式的匿名身份。不是链上钱包，也不签名。 */
export function loadOrCreateLocalId(): string {
  try {
    const existing = localStorage.getItem(LOCAL_ID);
    if (existing && existing.startsWith("local:")) return existing;
  } catch {
    /* ignore */
  }
  const id = `local:${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  try {
    localStorage.setItem(LOCAL_ID, id);
  } catch {
    /* ignore */
  }
  return id;
}
