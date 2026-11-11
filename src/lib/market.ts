import { AR_FEE_ADDR, splitWinston } from "../engine/catalog";
import { arweaveClient, gatewayOrigins } from "./gateways";
import type { Jwk } from "./wallet";
import type { TxProof } from "../types";

const arweave = arweaveClient();

export function marketBucket(role?: string) {
  if (role === "toxotes") return "bow";
  if (role === "hippeus") return "horse";
  if (role === "epibatai" || role === "trierarch") return "navy";
  if (role === "hoplite" || role === "peltast" || role === "citizen") return "foot";
  return "other";
}

export function arToWinston(ar: number): number {
  return Math.max(1, Math.floor(ar * 1e12));
}

export function winstonToAr(w: number): string {
  return (w / 1e12).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

export function splitFee(winston: number): { pay: number; burn: number } {
  return splitWinston(winston);
}

async function postWinston(jwk: Jwk, target: string, quantity: number, tags: Record<string, string>): Promise<string> {
  const tx = await arweave.createTransaction({ target, quantity: String(quantity) }, jwk as never);
  for (const [k, v] of Object.entries(tags)) tx.addTag(k, v);
  await arweave.transactions.sign(tx, jwk as never);
  let last = 0;
  for (const origin of gatewayOrigins()) {
    const res = await arweaveClient(origin).transactions.post(tx);
    last = res.status;
    if (res.status === 200 || res.status === 202) return tx.id;
  }
  throw new Error(`AR 转账失败 HTTP ${last}`);
}

export async function payListing(
  jwk: Jwk,
  buyer: string,
  seller: string,
  winston: number,
  cardId: string,
  listingId: string,
  cityId = "",
): Promise<{ payTx: string; burnTx: string; pay: number; burn: number; proofs: Record<string, TxProof> }> {
  const { pay, burn } = splitWinston(winston);
  const common = {
    "App-Name": "Rexue-Chengbang",
    "Card-Id": cardId,
    "Listing-Id": listingId,
    "City-Id": cityId,
    Seller: seller,
  };
  const payTx = await postWinston(jwk, seller, pay, { ...common, Type: "card-sale" });
  const burnTx = await postWinston(jwk, AR_FEE_ADDR, burn, { ...common, Type: "card-fee" });
  return {
    payTx,
    burnTx,
    pay,
    burn,
    proofs: {
      [payTx]: { id: payTx, from: buyer, target: seller, winston: pay, listingId, cityId, kind: "sale" },
      [burnTx]: { id: burnTx, from: buyer, target: AR_FEE_ADDR, winston: burn, listingId, cityId, kind: "fee" },
    },
  };
}
