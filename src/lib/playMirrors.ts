/** Static copies of the game (web branch). Body stays off Arweave. */

export const GITHUB_PAGES = "https://maya970.github.io/rexue-chengbang/";

export const GH_WEB = "maya970/rexue-chengbang@web";

/** Stable Turbo id of the tiny boot page. Filled by scripts/publish-launcher.ts */
export const LAUNCHER_TX = "awLIQudxnnLBbCDaOBByjkSe2WW0yxtZ7Kcfl0kTo4g";

export function gameMirrors(): string[] {
  const gh = "maya970/rexue-chengbang";
  return [
    `https://cdn.jsdmirror.com/gh/${gh}@web/index.html`,
    `https://cdn.jsdmirror.cn/gh/${gh}@web/index.html`,
    `https://testingcf.jsdelivr.net/gh/${gh}@web/index.html`,
    `https://fastly.jsdelivr.net/gh/${gh}@web/index.html`,
    `https://gcore.jsdelivr.net/gh/${gh}@web/index.html`,
    `https://cdn.jsdelivr.net/gh/${gh}@web/index.html`,
    `https://jsd.onmicrosoft.cn/gh/${gh}@web/index.html`,
    `https://cdn.statically.io/gh/${gh}/web/index.html`,
    `https://ghproxy.net/https://maya970.github.io/rexue-chengbang/`,
    `https://gh.ddlc.top/https://maya970.github.io/rexue-chengbang/`,
    GITHUB_PAGES,
  ];
}

export function bootHtml(mirrors = gameMirrors()) {
  const first = mirrors[0];
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="refresh" content="12;url=${first}"/>
<title>热血城邦</title>
<style>
body{margin:0;background:#1a140c;color:#f3e6c4;font:16px/1.5 sans-serif;padding:28px}
a{color:#e8c36a;word-break:break-all}
h1{font-size:20px}
</style>
</head>
<body>
<h1>热血城邦</h1>
<p>正在挑选可打开的入口… 游戏本体在镜像上，不经过 GitHub 也能玩。</p>
<p id="list"></p>
<script>
var M=${JSON.stringify(mirrors)};
var box=document.getElementById("list");
for(var i=0;i<M.length;i++){
  var a=document.createElement("a");
  a.href=M[i]; a.textContent=M[i];
  box.appendChild(a); box.appendChild(document.createElement("br"));
}
(async function(){
  for(var i=0;i<M.length;i++){
    try{
      var r=await fetch(M[i],{cache:"no-store",mode:"cors"});
      if(r.ok){location.replace(M[i]);return;}
    }catch(e){}
  }
  location.replace(M[0]);
})();
</script>
</body>
</html>
`;
}

export function gatewayPlayUrls(origins: string[], tx = LAUNCHER_TX) {
  if (!tx || tx.startsWith("REPLACE")) return [];
  return origins.map((o) => `${o.replace(/\/$/, "")}/${tx}`);
}
