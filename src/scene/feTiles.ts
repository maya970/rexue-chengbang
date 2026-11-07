/** Fire Emblem / RPG Maker GBA-style 16×16 tiles, nearest-neighbor only. */

const P: Record<string, string> = {
  ".": "",
  k: "#201810",
  g: "#a8d070",
  h: "#78b050",
  d: "#508838",
  n: "#386828",
  f: "#246838",
  F: "#165028",
  e: "#0c3818",
  t: "#684830",
  T: "#483020",
  m: "#c0b098",
  M: "#807060",
  s: "#e8e0d0",
  a: "#e8d090",
  A: "#c8a858",
  w: "#48b0d8",
  W: "#2a80b8",
  u: "#186090",
  U: "#0e4068",
  x: "#f0e8d8",
  r: "#c83828",
  R: "#881818",
  y: "#f0c040",
  b: "#3868b0",
  p: "#d8a070",
  o: "#703818",
  c: "#889098",
  C: "#607078",
  i: "#f8f4e8",
  v: "#5c4030",
};

export const TILE = 16;

function paint(ctx: CanvasRenderingContext2D, rows: string[], ox = 0, oy = 0) {
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const col = P[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

function sheet(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function hash(x: number, y: number, salt: number) {
  let n = (x * 374761393 + y * 668265263 + salt * 144959613) >>> 0;
  n ^= n << 13;
  n >>>= 0;
  n ^= n >> 17;
  return n >>> 0;
}

function grass(v: number, forestish = false): string[] {
  const base = forestish
    ? [
      "ffffffffffffffff",
      "fFffFfffFffFffff",
      "ffFffffFffffFfff",
      "ffffFffffffFffff",
      "fFffffFfffFfffFf",
      "ffffFffffFffffff",
      "ffFffffFffffFfff",
      "ffffffFffffFffff",
      "fFffFffffffFffff",
      "ffffFfffFffffFff",
      "ffFffffffFffffff",
      "ffffffFffffFffFf",
      "fFffffFfffFfffff",
      "ffffFffffffFffff",
      "ffFfffFfffFfffFf",
      "ffffffffffffffff",
    ]
    : [
      "ghghghghghghghgh",
      "hghghghghghghghg",
      "ghghdhghghghghgh",
      "hghghghghdhghghg",
      "ghghghghghghghgh",
      "hghghdhghghghghg",
      "ghghghghghdhghgh",
      "hghghghghghghghg",
      "ghdhghghghghghgh",
      "hghghghghghghdhg",
      "ghghghghdhghghgh",
      "hghghghghghghghg",
      "ghghghghghghdhgh",
      "hghghdhghghghghg",
      "ghghghghghghghgh",
      "hghghghghghghghg",
    ];
  const rows = base.map((r) => r.split(""));
  if (v % 5 === 0) rows[3][4] = "y";
  if (v % 7 === 1) rows[10][11] = "y";
  if (v % 4 === 2) rows[7][2] = forestish ? "e" : "n";
  return rows.map((r) => r.join(""));
}

function trees(): string[] {
  return [
    "................",
    "......kk........",
    "....kkffkk......",
    "...kffffffk.....",
    "...kFfFfFfk.....",
    "....kFFFFFk.....",
    "......tT........",
    "....kkffkk......",
    "...kffffffk.....",
    "..kfFfFfFffk....",
    "...kFFFFFFk.....",
    ".....ttTt.......",
    "......TT........",
    "....nnddnn......",
    "...nddddddn.....",
    "................",
  ];
}

function mountain(): string[] {
  return [
    "................",
    ".......s........",
    "......sms.......",
    ".....smmms......",
    "....smMmmMs.....",
    "...smMmmmMms....",
    "..smmMMmmMmms...",
    ".smmmMMMmMmmms..",
    "smmMMmmmmmMMmms.",
    "mmMmmMMmmMMmmmmk",
    "MmmmmMMMmMmmmmMk",
    "mmMMmmmmmMMmmMmk",
    "MmmkMkkkkMkkmmMk",
    "mkk..........kkm",
    "................",
    "................",
  ];
}

function coast(v: number): string[] {
  const rows = [
    "aaaaaaaaaaaaaaaa",
    "aAaAaAaAaAaAaAaA",
    "aaaaaaaaaaaaaaaa",
    "AaAaAaAaAaAaAaAa",
    "aaaaAaaaaaaaaaaa",
    "aAaAaAaAaAaAaAaA",
    "aaaaaaaaaaaaaaaa",
    "wwwwAwwwAwwwwwww",
    "wWwwwwWwwwwwWwww",
    "WwwwwwwwwWwwwwWw",
    "uWuWuWuWuWuWuWuW",
    "WuWuWuWuWuWuWuWu",
    "uuuuuuuuuuuuuuuu",
    "uUuUuUuUuUuUuUuU",
    "Uuuuuuuuuuuuuuuu",
    "uUuUuUuUuUuUuUuU",
  ];
  if (v % 2) rows[7] = "wwwAwwwwAwwwwwww";
  return rows;
}

function sea(frame: number): string[] {
  if (frame === 0) {
    return [
      "WWWWWWWWWWWWWWWW",
      "WwWwwwWwwwWwwwWw",
      "wWwWwWwWwWwWwWwW",
      "WwWwwwWwwwWwwwWw",
      "WWWWWWWWWWWWWWWW",
      "wwwWwwwWwwwWwwww",
      "WwWwWwWwWwWwWwWw",
      "wwwWwwwWwwwWwwww",
      "WWWWWWWWWWWWWWWW",
      "WwwwWwwwWwwwWwwW",
      "wWwWwWwWwWwWwWwW",
      "WwwwWwwwWwwwWwwW",
      "WWWWWWWWWWWWWWWW",
      "wwwWwwwWwwwWwwww",
      "uWuWuWuWuWuWuWuW",
      "WWWWWWWWWWWWWWWW",
    ];
  }
  return [
    "WWWWWWWWWWWWWWWW",
    "wwwWwwwWwwwWwwww",
    "WwWwWwWwWwWwWwWw",
    "wwwWwwwWwwwWwwww",
    "WWWWWWWWWWWWWWWW",
    "WwWwwwWwwwWwwwWw",
    "wWwWwWwWwWwWwWwW",
    "WwWwwwWwwwWwwwWw",
    "WWWWWWWWWWWWWWWW",
    "wwwWwwwWwwwWwwww",
    "WwWwWwWwWwWwWwWw",
    "wwwWwwwWwwwWwwww",
    "WWWWWWWWWWWWWWWW",
    "WwwwWwwwWwwwWwwW",
    "WuWuWuWuWuWuWuWu",
    "WWWWWWWWWWWWWWWW",
  ];
}

const VILLAGE = [
  "......kkkk......",
  ".....krrrRk.....",
  "....krrrrrrk....",
  "...krrrrrrrrk...",
  "..kxxxxxxxxxxk..",
  "..kx.x.xx.x.xk..",
  "..kxxxxxxxxxxk..",
  "..kx.xkxxk.x.k..",
  "..kxxxxxxxxxxk..",
  "...kkkkkkkkkk...",
  "....hhdhhhdh....",
  "...hdhhhhhdhh...",
  "................",
  "................",
  "................",
  "................",
];

const CASTLE = [
  "..y..........y..",
  ".kkk........kkk.",
  ".krk.kkkkkk.krk.",
  ".kkk.kxxxxk.kkk.",
  ".....kxkkxk.....",
  ".kkkkkxkkxkkkkk.",
  ".kxxxkxxxxkxxxk.",
  ".kxkxkxxxxkxkxk.",
  ".kxxxkkkkkkxxxk.",
  ".kkkkkkkkkkkkkk.",
  "..kxxxxxxxxxxk..",
  "..kx.x.kk.x.xk..",
  "..kxxxxxxxxxxk..",
  "...kkkkkkkkkk...",
  "....nndddnnn....",
  "................",
];

const TRIBE = [
  "................",
  "......kk........",
  ".....koook......",
  "....kovvvok.....",
  "...kovvvvvok....",
  "..kovvvvvvvok...",
  ".kkkkkkkkkkkkk..",
  "..kv.v.kk.v.vk..",
  "..kvvvvvvvvvvk..",
  "...kkkkkkkkkk...",
  "....nndnndnn....",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const SHIP = [
  "................",
  "........y.......",
  ".......kyk......",
  ".......kxk......",
  "......kxxxk.....",
  "......kxxxk.....",
  ".....kxxxxxk....",
  "kkkkkkkkkkkkkkk.",
  ".kccccccccccck..",
  "..kCCCCCCCCCk...",
  "...kWWWWWWWk....",
  "....kWWWWWk.....",
  ".....uuuuu......",
  "................",
  "................",
  "................",
];

const ARMY_A = [
  "................",
  ".....kkkk.......",
  "....kyyyyk......",
  "....kyiiyk......",
  ".....kppk.......",
  "....kkbbkk......",
  "...kbbbbbbk.....",
  "....kbkkbk......",
  "....k.kk.k......",
  "....k....k......",
  "....kk..kk......",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const ARMY_B = [
  "................",
  ".....kkkk.......",
  "....kyyyyk......",
  "....kyiiyk......",
  ".....kppk.......",
  "....kkbbkk......",
  "...kbbbbbbk.....",
  "....kbkkbk......",
  ".....k..k.......",
  "....k....k......",
  "...kk....kk.....",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const FLAG = [
  "k...............",
  "kyyy............",
  "kyyy............",
  "kyy.............",
  "k...............",
  "k...............",
  "................",
  "................",
];

export type MapSprite = "plain" | "forest" | "mountain" | "coast" | "sea" | "village" | "city" | "tribe" | "ship" | "army" | "flag";

const cache = new Map<string, HTMLCanvasElement>();

function bake(key: string, rows: string[]) {
  let hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = sheet(TILE, TILE);
  paint(ctx, rows);
  cache.set(key, c);
  return c;
}

export function terrainSprite(kind: "plain" | "forest" | "mountain" | "coast" | "sea", x: number, y: number, frame: number) {
  const v = hash(x, y, 3) % 8;
  if (kind === "plain") return bake(`p${v}`, grass(v));
  if (kind === "forest") {
    const key = `f${v}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const { c, ctx } = sheet(TILE, TILE);
    paint(ctx, grass(v, true));
    paint(ctx, trees());
    if (v % 2 === 0) paint(ctx, trees(), -4, 2);
    cache.set(key, c);
    return c;
  }
  if (kind === "mountain") return bake("mtn", mountain());
  if (kind === "coast") return bake(`c${v}`, coast(v));
  return bake(`sea${frame % 2}`, sea(frame % 2));
}

export function overlaySprite(kind: "village" | "city" | "tribe" | "ship" | "army" | "flag", frame = 0) {
  if (kind === "village") return bake("vil", VILLAGE);
  if (kind === "city") return bake("cas", CASTLE);
  if (kind === "tribe") return bake("trb", TRIBE);
  if (kind === "ship") return bake("shp", SHIP);
  if (kind === "flag") return bake("flg", FLAG);
  return bake(frame % 2 ? "ar1" : "ar0", frame % 2 ? ARMY_B : ARMY_A);
}

export function blit(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  scale: number,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, TILE * scale, TILE * scale);
}

export function drawFeCursor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, now: number) {
  const pulse = Math.floor(now / 160) % 2;
  const inset = pulse ? 1 : 0;
  const len = Math.max(4, Math.floor(size * 0.28));
  const t = Math.max(2, Math.floor(size / 16));
  ctx.fillStyle = "#f8f0a8";
  const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
    ctx.fillRect(cx, cy, len * dx || t, t);
    ctx.fillRect(cx, cy, t, len * dy || t);
  };
  const x0 = x + inset;
  const y0 = y + inset;
  const x1 = x + size - 1 - inset;
  const y1 = y + size - 1 - inset;
  drawCorner(x0, y0, 1, 1);
  ctx.fillRect(x1 - len, y0, len, t);
  ctx.fillRect(x1 - t + 1, y0, t, len);
  ctx.fillRect(x0, y1 - t + 1, len, t);
  ctx.fillRect(x0, y1 - len, t, len);
  ctx.fillRect(x1 - len, y1 - t + 1, len, t);
  ctx.fillRect(x1 - t + 1, y1 - len, t, len);
}
