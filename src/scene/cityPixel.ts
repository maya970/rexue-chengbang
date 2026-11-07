import { BUILDINGS } from "../engine/catalog";
import { u32 } from "../engine/hash";
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
  for (let y = 0; y < CTILE; y += 1) {
    const row = (rows[y] || "").padEnd(CTILE, ".");
    for (let x = 0; x < CTILE; x += 1) {
      const col = P[row[x]];
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
    "y..............y",
    "kyk.kkkkkkkk.kyk",
    "krk.kxxxxrrk.krk",
    "kkk.kxbbxrrk.kkk",
    ".kkkkxbbxrrkkkk.",
    ".kxxxkxxxxkxxxk.",
    ".kxkxkyyyykxkxk.",
    ".kxxxkkkkkkxxxk.",
    ".kkkkkxbbxkkkkk.",
    ".kxxxxbbbbxxxxk.",
    ".kx.x.kkkk.x.xk.",
    ".kxxxxxxxxxxxxk.",
    ".kkkkkkkkkkkkkk.",
    "..kssssssssssk..",
    "...sshhhhhhss...",
    "....hhhhhhhh....",
  ],
  agora: [
    ".kkkkkkkkkkkkkk.",
    ".kyx.x.x.x.xyk.",
    ".kxxxxxxxxxxxxk.",
    ".kxAAAAAAAAAAxk.",
    ".kxA........Axk.",
    ".kxA.kkkkkk.Axk.",
    ".kxA.kxxxxk.Axk.",
    ".kxA.kxkkxk.Axk.",
    ".kxA.kxxxxk.Axk.",
    ".kxA.kkkkkk.Axk.",
    ".kxA........Axk.",
    ".kxAAAAAAAAAAxk.",
    ".kxxxxxxxxxxxxk.",
    ".kkkkkkkkkkkkkk.",
    "..ssssssssssss..",
    "....ssssssss....",
  ],
  oikos: [
    "......kkkk......",
    ".....krrrRk.....",
    "....krrrrrRk....",
    "...krrrrrrrRk...",
    "..kxxxxxxxxxxk..",
    "..kxp.pxxp.pxk..",
    "..kxxxxxxxxxxk..",
    "..kxp.kkkk.pxk..",
    "..kxxxxxxxxxxk..",
    "..kkkkkkkkkkkk..",
    "...hppppppppph..",
    "...hphphphphph..",
    "....hhhhhhhh....",
    "....gghgghgg....",
    "...gghgghgghg...",
    "..ghghghghghgh..",
  ],
  barracks: [
    "kkkkkkkkkkkkkkkk",
    "krrrrrrrrrrrrrrk",
    "kxxxxxxxxxxxxxxk",
    "kxkk.ssss.kk.xkk",
    "kxxxxxxxxxxxxxxk",
    "kxkk.ssss.kk.xkk",
    "kxxxxxxxxxxxxxxk",
    "kx.k.kkkk.k..xkk",
    "kxxxxxxxxxxxxxxk",
    "kkkkkkkkkkkkkkkk",
    ".oooooooooooooo.",
    ".oAooAooAooAooA.",
    ".oooooooooooooo.",
    "..sssskkssss....",
    "...ssssssss.....",
    "....oooooooo....",
  ],
  stables: [
    ".kkkkkkkkkkkkkk.",
    ".koooooooooook.",
    ".koA.A.A.A.Aok.",
    ".koooooooooook.",
    ".koxx.xx.xx.ok.",
    ".koooooooooook.",
    ".koxx.kk.xx.ok.",
    ".koooooooooook.",
    ".kkkkkkkkkkkkkk.",
    "..AAaaAAaaAAaa..",
    "..aaAAaaAAaaAA..",
    "..oooooooooooo..",
    "..o..kkkkkk..o..",
    "...AAaaAAaaAA...",
    "....oooooooo....",
    ".....AAaaAA.....",
  ],
  range: [
    "....kkkkkkkk....",
    "...kddddddddk...",
    "...kd.t.t.tdk...",
    "...kddddddddk...",
    "...kdtkkkktdk...",
    "...kddddddddk...",
    "..kkkkkkkkkkkk..",
    "..khh.tttt.hhk..",
    "..khhhhhhhhhhk..",
    "...kkkkkkkkkk...",
    "....t.t.t.t.....",
    "....hhhhhhhh....",
    "...hhgghhgghh...",
    "..gghgghgghggh..",
    "...dddddddd.....",
    "....hhhhhhhh....",
  ],
  wall: [
    "kkkkkkkkkkkkkkkk",
    "kSSSSSSSSSSSSSSk",
    "kSkkSssSssSkkSSk",
    "kSSSSSSSSSSSSSSk",
    "kSssSsskkssSssSk",
    "kSSSSSSSSSSSSSSk",
    "kkkkkkkkkkkkkkkk",
    "mmSmmSmmSmmSmmSm",
    "SmmmmSmmmmSmmmmS",
    "mmSmmkkkkmmSmmmm",
    "SmmmSSSSSmmmSmmS",
    "mmSmmSmmSmmSmmmm",
    "....mmmmmmmm....",
    "...mmSmmSmmS....",
    "....mmmmmmmm....",
    ".....mmmmmm.....",
  ],
  temple: [
    "......y.y.......",
    ".....kyyyk......",
    "....kxxxxxk.....",
    "...kxxxyxxxk....",
    "..kxxxxxxxxxk...",
    "..kx.x.k.x.xk...",
    "..kxxxxxxxxxk...",
    "..kxkkkkkkkxk...",
    "..kxxxxxxxxxk...",
    "...kkkkkkkkk....",
    "....xhhhhhhx....",
    ".....hhhhh......",
    "....hhggghh.....",
    "...y.hhhhhh.y...",
    "....hhhhhhhh....",
    ".....hhhhhh.....",
  ],
  shipyard: [
    "..kkkkkkkkkkkk..",
    "..kc.c.c.c.c.k..",
    "..kcccccccccck..",
    "..kc.c.y.c.c.k..",
    "..kcccccccccck..",
    "..kkkkkkkkkkkk..",
    "...tttttttttt...",
    "...twwwwwwwwt...",
    "...twkkkkkkwt...",
    "...twwwwwwwwt...",
    "....wwwwwwww....",
    "....oooooooo....",
    "...oAoAoAoAoA...",
    "....wwwwwwww....",
    "...tttttttttt...",
    "....wwwwwwww....",
  ],
  harbor: [
    "........y.......",
    ".......kyk......",
    "......kxxxk.....",
    ".....kxxxxxk....",
    "kkkkkkkkkkkkkkkk",
    "kcccccccccccccck",
    ".kwwwwywwwwwwk..",
    "..kwwwwwwwwwk...",
    "...kwwkkwwwk....",
    "....oooooooo....",
    "...oAoAoAoAoA...",
    "....tttttttt....",
    "...twwwwwwwt....",
    "....wwwwwwww....",
    "...oooooooooo...",
    "....wwwwwwww....",
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

function generateHouse(id: string): string[] {
  const rows = Array.from({ length: 16 }, () => Array(16).fill("."));
  const put = (x: number, y: number, ch: string) => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) rows[y][x] = ch;
  };
  const h = u32(id);
  const roof = id === "acropolis" ? "r" : id === "temple" ? "x" : id === "range" ? "d" : id === "stables" ? "o" : id === "shipyard" || id === "harbor" ? "c" : id === "wall" ? "S" : id === "agora" ? "A" : id === "barracks" ? "s" : "R";
  const wall = id === "harbor" || id === "shipyard" ? "t" : "k";
  const body = id === "oikos" ? "p" : id === "stables" ? "o" : id === "range" ? "h" : "x";
  const peak = 2 + (h % 2);
  for (let y = peak; y < 8; y += 1) {
    const span = y - peak + 2;
    for (let x = 8 - span; x < 8 + span; x += 1) put(x, y, roof);
  }
  for (let y = 8; y < 14; y += 1) {
    for (let x = 3; x < 13; x += 1) put(x, y, y === 8 || x === 3 || x === 12 ? wall : body);
  }
  put(7, 11, "k");
  put(8, 11, "k");
  put(7, 12, "k");
  put(8, 12, "k");
  if (id === "acropolis") {
    put(4, 2, "y");
    put(11, 2, "y");
    put(4, 3, "k");
    put(11, 3, "k");
  }
  if (id === "range") {
    for (let x = 2; x < 14; x += 2) put(x, 6, "t");
  }
  if (id === "stables") {
    put(5, 13, "A");
    put(10, 13, "A");
  }
  if (id === "harbor" || id === "shipyard") {
    for (let x = 2; x < 14; x += 1) put(x, 14, "w");
    put(8, 4, "y");
  }
  if (id === "wall") {
    for (let x = 0; x < 16; x += 1) {
      put(x, 7, "k");
      put(x, 8, "S");
      put(x, 9, "s");
    }
  }
  if (id === "temple") {
    put(5, 5, "y");
    put(10, 5, "y");
    put(8, 3, "y");
  }
  return rows.map((r) => r.join(""));
}

export function buildingTile(id: BuildingId) {
  return bake(`b:${id}`, HOUSE[id] || generateHouse(id));
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
