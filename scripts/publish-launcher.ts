import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Arweave from "arweave";
import { allGatewayOrigins, FREE_GATEWAYS, loadNetworkGateways } from "../src/lib/gateways.ts";
import { bootHtml, gameMirrors, GITHUB_PAGES } from "../src/lib/playMirrors.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = bootHtml();
if (new TextEncoder().encode(html).length > 100 * 1024) {
  throw new Error("启动页超过免费 100KiB");
}

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "boot.html"), html);

const arweave = Arweave.init({ host: "arweave.net", port: 443, protocol: "https" });
const jwk = process.env.LAUNCHER_JWK
  ? (JSON.parse(process.env.LAUNCHER_JWK) as Record<string, unknown>)
  : await arweave.wallets.generate();

const { ArweaveSigner, createData } = await import("arbundles");
const signer = new ArweaveSigner(jwk as never);
const data = createData(html, signer, {
  tags: [
    { name: "Content-Type", value: "text/html; charset=utf-8" },
    { name: "App-Name", value: "rexue-chengbang" },
    { name: "Type", value: "play-boot" },
  ],
});
await data.sign(signer);
const res = await fetch("https://upload.ardrive.io/v1/tx", {
  method: "POST",
  headers: { "content-type": "application/octet-stream" },
  body: data.getRaw(),
});
if (!res.ok) {
  throw new Error(`启动页上传失败 HTTP ${res.status} ${await res.text()}`);
}
const json = (await res.json().catch(() => ({ id: data.id }))) as { id?: string };
const txId = json.id || data.id;

writeFileSync(join(root, "scripts", "launcher-tx.json"), JSON.stringify({ txId, at: Date.now() }, null, 2));
const mirrorsFile = join(root, "src", "lib", "playMirrors.ts");
const { readFileSync } = await import("node:fs");
writeFileSync(
  mirrorsFile,
  readFileSync(mirrorsFile, "utf8").replace(/export const LAUNCHER_TX = "[^"]+";/, `export const LAUNCHER_TX = "${txId}";`),
);

await loadNetworkGateways();
const origins = [...new Set([...FREE_GATEWAYS, ...allGatewayOrigins()])];
const lines = [
  "# 热血城邦入口",
  "",
  "## 镜像（大陆优先，点开即玩）",
  ...gameMirrors().map((u) => `- ${u}`),
  "",
  `## GitHub Pages`,
  `- ${GITHUB_PAGES}`,
  "",
  `## 任意免费 AR.IO 网关（同一启动页 ${txId}）`,
  ...origins.map((o) => `- ${o.replace(/\/$/, "")}/${txId}`),
  "",
];
writeFileSync(join(root, "PLAY.md"), lines.join("\n"));
console.log(lines.join("\n"));
console.log("launcher", txId, "bytes", new TextEncoder().encode(html).length);
