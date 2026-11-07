import { BUILDINGS } from "../engine/catalog";
import type { BuildingId, PlotKind } from "../types";

const P: Record<string, string> = {
  ".": "",
  k: "#201810",
  g: "#88c060",
  h: "#609848",
  d: "#486830",
  a: "#d8c090",
  A: "#b89860",
  s: "#c8c0b0",
  S: "#908880",
  r: "#c04030",
  R: "#801818",
  x: "#f0e8d8",
  b: "#3858a0",
  y: "#f0c038",
  o: "#704028",
  t: "#3a2818",
  w: "#48a8d0",
  n: "#e8d8b0",
  p: "#d8a070",
  i: "#f8f4e8",
  c: "#889098",
  m: "#a09080",
};

export const CTILE = 16;

function sheet() {
  const c = document.createElement("canvas");
  c.width = CTILE;
  c.height = CTILE;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function paint(ctx: CanvasRenderingContext2D, rows: string[]) {
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const col = P[rows[y][x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const cache = new Map<string, HTMLCanvasElement>();

function bake(key: string, rows: string[]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, ctx } = sheet();
  paint(ctx, rows);
  cache.set(key, c);
  return c;
}

const EMPTY: Record<PlotKind, string[]> = {
  plaza: [
    "ssssssssssssssss",
    "sSssSssSssSssSss",
    "ssssssssssssssss",
    "sSss......ssSsss",
    "sss........sssss",
    "sS..........sSss",
    "ss..........ssss",
    "ss..........ssss",
    "sS..........sSss",
    "sss........sssss",
    "sSss......ssSsss",
    "ssssssssssssssss",
    "sSssSssSssSssSss",
    "ssssssssssssssss",
    "sSssSssSssSssSss",
    "ssssssssssssssss",
  ],
  housing: [
    "gghgghgghgghgghg",
    "hgghAAaaAAhgghgg",
    "gghga....aggghgg",
    "hggga....ahgghgg",
    "gghga....aggghgg",
    "hgggAAaaAAhgghgg",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
    "gghgghddhgghgghg",
    "hgghgghgghgghggh",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
  ],
  camp: [
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaa......aaAAaa",
    "aaAa......aAaaAA",
    "AAaa......aaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAkkAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
  ],
  grove: [
    "gghgghgghgghgghg",
    "hgghkkhgghkkhggh",
    "gghkddkhgkddkhgg",
    "hggkddkggkddkggh",
    "gghgtkthggtkthgg",
    "hgghttthghttthgh",
    "gghgghgghgghgghg",
    "hgghgghgghkkhggh",
    "gghgghgghkddkhgg",
    "hgghgghggkddkggh",
    "gghgghggggtkthgg",
    "hgghgghgghttthgh",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
    "gghgghgghgghgghg",
    "hgghgghgghgghggh",
  ],
  quarry: [
    "mmSmmSmmSmmSmmSm",
    "SmmmmSmmmmSmmmmS",
    "mmSmmkkmmSmmSmmm",
    "SmmmSSSSSmmmSmmS",
    "mmSmSmmmmSmSmmmm",
    "SmmmmSmmSmmmSmmS",
    "mmSmmmmSmmSmmSmm",
    "SmmSmmmmSmmmSmmS",
    "mmmmSmmSmmSmmSmm",
    "SmmmmSmmmmSmmmSm",
    "mmSmmkkmmSmmSmmm",
    "SmmmSSSSSmmSmmSm",
    "mmSmmSmmSmmSmmmm",
    "SmmmmSmmmmSmmmSm",
    "mmSmmSmmSmmSmmSm",
    "SmmmmSmmmmSmmmmS",
  ],
  harbor: [
    "wwwwwwwwwwwwwwww",
    "wtttttttttttttww",
    "wtn.n.n.n.n.ntww",
    "wtttttttttttttww",
    "wwwwwwwwwwwwwwww",
    "wtttttttttttttww",
    "wt.n.n.n.n.n.tww",
    "wtttttttttttttww",
    "wwwwwwwwwwwwwwww",
    "oooooooooooooooo",
    "oAoAoAoAoAoAoAoA",
    "oooooooooooooooo",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
  ],
  yard: [
    "oooooooooooooooo",
    "oAoAoAoAoAoAoAoA",
    "oooooooooooooooo",
    "oA..........AoAo",
    "oo..........oooo",
    "oA..........AoAo",
    "oooooooooooooooo",
    "oAoAoAkkAoAoAoAo",
    "oooooooooooooooo",
    "oAoAoAoAoAoAoAoA",
    "oooooooooooooooo",
    "AAaaAAaaAAaaAAaa",
    "aaAAaaAAaaAAaaAA",
    "oooooooooooooooo",
    "oAoAoAoAoAoAoAoA",
    "oooooooooooooooo",
  ],
};

const ROAD = [
  "SSSSSSSSSSSSSSSS",
  "SssSssSssSssSssS",
  "ssssssssssssssss",
  "SssSssSssSssSssS",
  "ssssssssssssssss",
  "SssSsskkssSssSsS",
  "ssssssssssssssss",
  "SssSssSssSssSssS",
  "ssssssssssssssss",
  "SssSssSssSssSssS",
  "ssssssssssssssss",
  "SssSsskkssSssSsS",
  "ssssssssssssssss",
  "SssSssSssSssSssS",
  "ssssssssssssssss",
  "SSSSSSSSSSSSSSSS",
];

const GRASS = [
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

const HOUSE: Record<string, string[]> = {
  acropolis: [
    "..y..........y..",
    ".kkk........kkk.",
    ".krk.kkkkkk.krk.",
    ".kkk.kxxxxk.kkk.",
    ".....kxbbxk.....",
    ".kkkkkxbbxkkkkk.",
    ".kxxxkxxxxkxxxk.",
    ".kxkxkxxxxkxkxk.",
    ".kxxxkkkkkkxxxk.",
    ".kkkkkkkkkkkkkk.",
    "..kxxxxxxxxxxk..",
    "..kx.x.kk.x.xk..",
    "..kxxxxxxxxxxk..",
    "...kkkkkkkkkk...",
    "....ssssssss....",
    "................",
  ],
  agora: [
    "................",
    ".kkkkkkkkkkkkkk.",
    ".kxxxxxxxxxxxxk.",
    ".kx.x.x.x.x.xxk.",
    ".kxxxxxxxxxxxxk.",
    ".kxkkkkkkkkkkxk.",
    ".kxkxxxxxxxxkxk.",
    ".kxkxxkkkkxxkxk.",
    ".kxkxxxxxxxxkxk.",
    ".kxkkkkkkkkkkxk.",
    ".kxxxxxxxxxxxxk.",
    ".kkkkkkkkkkkkkk.",
    "....ssssssss....",
    "................",
    "................",
    "................",
  ],
  oikos: [
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
    "....hhhhhhhh....",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  barracks: [
    "................",
    ".kkkkkkkkkkkkkk.",
    ".krrrrrrrrrrrrk.",
    ".kxxxxxxxxxxxxk.",
    ".kx.kk....kk.xk.",
    ".kxxxxxxxxxxxxk.",
    ".kx.kk....kk.xk.",
    ".kxxxxxxxxxxxxk.",
    ".kkkkkkkkkkkkkk.",
    "..ooooooooooo...",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  stables: [
    "................",
    ".kkkkkkkkkkkkk..",
    ".koooooooooook..",
    ".koxx.xx.xx.ok..",
    ".koooooooooook..",
    ".koxx.xx.xx.ok..",
    ".koooooooooook..",
    ".kkkkkkkkkkkkk..",
    "..AAaaAAaaAA....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  range: [
    "................",
    "....kkkkkkkk....",
    "...kddddddddk...",
    "...kd.d.d.ddk...",
    "...kddddddddk...",
    "...kdkkkkkkdk...",
    "...kddddddddk...",
    "....kkkkkkkk....",
    ".....hhhhhh.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  wall: [
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSssSssSssSssSSk",
    "kSSSSSSSSSSSSSSk",
    "kSssSsskkssSssSk",
    "kSSSSSSSSSSSSSSk",
    "kkkkkkkkkkkkkkkk",
    "....mmmmmmmm....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  temple: [
    "......y.y.......",
    ".....kkkkk......",
    "....kxxxxxk.....",
    "...kxxxxxxxk....",
    "..kxxxxxxxxxk...",
    "..kx.x.k.x.xk...",
    "..kxxxxxxxxxk...",
    "...kkkkkkkkk....",
    ".....hhhhh......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  shipyard: [
    "................",
    "..kkkkkkkkkkk...",
    "..kc.c.c.c.ck...",
    "..kccccccccck...",
    "..kc.c.c.c.ck...",
    "..kkkkkkkkkkk...",
    "...ttttttttt....",
    "...twwwwwwwt....",
    "....wwwwwww.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  harbor: [
    "........y.......",
    ".......kyk......",
    "......kxxxk.....",
    ".....kxxxxxk....",
    "kkkkkkkkkkkkkkk.",
    ".kccccccccccck..",
    "..kwwwwwwwwwk...",
    "...kwwwwwwwk....",
    "....ooooooo.....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
};

const WALK_A = [
  "................",
  ".....kkkk.......",
  "....kyyyyk......",
  "....kyiiyk......",
  ".....kppk.......",
  "....kkbbkk......",
  "...kbbbbbbk.....",
  "....kbkkbk......",
  "....k.kk.k......",
  "....kk..kk......",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const WALK_B = [
  "................",
  ".....kkkk.......",
  "....kyyyyk......",
  "....kyiiyk......",
  ".....kppk.......",
  "....kkbbkk......",
  "...kbbbbbbk.....",
  "....kbkkbk......",
  ".....k..k.......",
  "...kk....kk.....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const SLAVE_A = [
  "................",
  ".....kkkk.......",
  "....knnink......",
  ".....kppk.......",
  "....kkoook......",
  "...koooooook....",
  "....kokkok......",
  "....k.kk.k......",
  "....kk..kk......",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

export function emptyTile(kind: PlotKind) {
  return bake(`e:${kind}`, EMPTY[kind]);
}

export function roadTile() {
  return bake("road", ROAD);
}

export function grassTile() {
  return bake("grass", GRASS);
}

export function buildingTile(id: BuildingId) {
  return bake(`b:${id}`, HOUSE[id] || HOUSE.oikos);
}

export function walkerTile(slave: boolean, frame: number) {
  if (slave) return bake("sl0", SLAVE_A);
  return bake(frame % 2 ? "w1" : "w0", frame % 2 ? WALK_B : WALK_A);
}

export function blitCity(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, scale: number, flip = false) {
  ctx.imageSmoothingEnabled = false;
  const s = CTILE * scale;
  if (!flip) {
    ctx.drawImage(img, x, y, s, s);
    return;
  }
  ctx.save();
  ctx.translate(x + s, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, 0, 0, s, s);
  ctx.restore();
}

export function buildingLabel(id: BuildingId) {
  return BUILDINGS[id].name;
}
