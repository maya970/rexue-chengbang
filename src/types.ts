export type Terrain = "sea" | "coast" | "plain" | "forest" | "mountain";

export type PlotKind = "plaza" | "housing" | "camp" | "grove" | "quarry" | "harbor" | "yard";

export type BuildingId =
  | "acropolis"
  | "agora"
  | "oikos"
  | "barracks"
  | "stables"
  | "range"
  | "wall"
  | "temple"
  | "shipyard"
  | "harbor";

export interface CityPlot {
  id: string;
  lx: number;
  ly: number;
  kind: PlotKind;
  /** 这块空地已占用的建筑。空地未建则为空。同种建筑可占多块空地。 */
  building?: BuildingId;
  /** 这座建筑自己的等级。空地为 0。 */
  level?: number;
  job?: { to: number; finishAt: number; workerIds: string[]; material: number };
  wars?: Campaign[];
  timeMult: number;
  /** 连通缓坡高度，相邻格最多差 1。 */
  elev: number;
}

export type RoleId =
  | "hoplite"
  | "peltast"
  | "toxotes"
  | "hippeus"
  | "epibatai"
  | "trierarch"
  | "citizen"
  | "slave"
  | "supply"
  | "trireme"
  | "transport";

export type CardKind = "person" | "slave" | "ship" | "supply";

export type CommandKind =
  | "found_city"
  | "upgrade"
  | "recruit"
  | "form_squad"
  | "march"
  | "recall"
  | "buy_slave"
  | "enfranchise"
  | "list_card"
  | "delist_card"
  | "buy_card"
  | "create_guild"
  | "join_guild"
  | "leave_guild"
  | "upgrade_site"
  | "rename_city";

export type MarchMission = "plunder" | "massacre" | "destroy" | "occupy" | "reinforce" | "colonize" | "scout" | "settle";

export type HamletKind = "city" | "village" | "suburb" | "urban";

export type SystemRank = "town" | "city" | "metro";

export interface Guild {
  id: string;
  name: string;
  leader: string;
  members: string[];
  createdAt: number;
}

export interface Campaign {
  id: string;
  name: string;
  time: number;
}

export interface Command {
  id: string;
  kind: CommandKind;
  label: string;
  cityId?: string;
  building?: BuildingId;
  plotId?: string;
  role?: RoleId;
  name?: string;
  x?: number;
  y?: number;
  fromCityId?: string;
  toX?: number;
  toY?: number;
  personIds?: string[];
  shipIds?: string[];
  workerIds?: string[];
  squadId?: string;
  marchId?: string;
  mission?: MarchMission;
  cardId?: string;
  listingId?: string;
  priceWinston?: number;
  payTx?: string;
  burnTx?: string;
  feeTx?: string;
  guildId?: string;
  /** 一次招募多张。 */
  count?: number;
}

export interface CommandBatch {
  protocol: "permabin";
  app: string;
  collection: "command-batches";
  key: string;
  owner: string;
  clientTime: number;
  commands: Command[];
}

export type BatchStatus = "queued" | "queued_uploaded" | "sent" | "failed";

export interface TxProof {
  id: string;
  from: string;
  target: string;
  winston: number;
  listingId: string;
  cityId?: string;
  time?: number;
  kind: "sale" | "fee";
}

export interface MarketPair {
  listingId: string;
  buyer: string;
  cityId: string;
  pay: TxProof;
  fee: TxProof;
  time: number;
  key: string;
}

export interface TrackedBatch {
  key: string;
  owner: string;
  signer?: string;
  commands: Command[];
  clientTime: number;
  status: BatchStatus;
  txId?: string;
  error?: string;
  chainTime?: number;
  queryable?: boolean;
  proofs?: Record<string, TxProof>;
}

export interface BuildingState {
  level: number;
  job?: { to: number; finishAt: number; workerIds: string[]; material: number };
  wars: Campaign[];
}

export interface Card {
  id: string;
  kind: CardKind;
  role: RoleId;
  name: string;
  owner: string;
  /** 当前驻扎的城或乡村。 */
  cityId: string;
  /** 编制所属。出征、驻村都不改，招募上限按此计算。 */
  homeCityId?: string;
  bornAt: number;
  bornTx: string;
  campaigns: Campaign[];
  squadId?: string;
  marchId?: string;
  jobId?: string;
  listedWinston?: number;
  berth: number;
  speed: number;
}

export interface Listing {
  id: string;
  cardId: string;
  seller: string;
  winston: number;
  listedAt: number;
}

export interface Squad {
  id: string;
  owner: string;
  cityId: string;
  name: string;
  personIds: string[];
  shipIds: string[];
  formedAt: number;
}

export interface City {
  id: string;
  owner: string;
  name: string;
  x: number;
  y: number;
  buildings: Partial<Record<BuildingId, BuildingState>>;
  plots: CityPlot[];
  foundedAt: number;
  npc: boolean;
  frontage: number;
  buildMult: Partial<Record<BuildingId, number>>;
  wars: Campaign[];
  tribeLevel?: number;
  systemRank?: SystemRank;
  /** 城邦本体，或附属乡村/郊区/城区。 */
  hamlet?: HamletKind;
  parentId?: string;
  /** 曾经达到过的等级，用于地图 LV.（曾是）。 */
  peakLevel?: number;
}

export interface GoneSite {
  at: number;
  respawnAt: number;
  level: number;
}

export interface March {
  id: string;
  owner: string;
  fromCityId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  squadId: string;
  personIds: string[];
  shipIds: string[];
  mission: MarchMission;
  startAt: number;
  arriveAt: number;
  path: { x: number; y: number }[];
  naval: boolean;
  entropy: string;
}

export interface BattleHit {
  kind: "kill" | "miss";
  striker: string;
  tgt: string;
  roll: string;
  chance: string;
  rear?: boolean;
  frail?: boolean;
}

export type RoundParams = Record<string, string | number | boolean | BattleHit[] | undefined>;

export interface BattleRound {
  title: string;
  text: string;
  key?: string;
  params?: RoundParams;
}

export interface BattleReport {
  id: string;
  time: number;
  title: string;
  /** 展示用标题键，切语言时重译。 */
  code?: string;
  attacker: string;
  defender: string;
  x: number;
  y: number;
  naval: boolean;
  field: boolean;
  win: boolean;
  collapsed?: "atk" | "def";
  rounds: BattleRound[];
  deadNames: string[];
  deadIds?: string[];
  deadAtkNames?: string[];
  deadDefNames?: string[];
  slaves?: number;
  supplies?: number;
  aftermath?: MarchMission;
}

export interface World {
  cities: Record<string, City>;
  cards: Record<string, Card>;
  squads: Record<string, Squad>;
  marches: Record<string, March>;
  listings: Record<string, Listing>;
  reports: BattleReport[];
  skipped: string[];
  resolvedClash: Record<string, true>;
  gone: Record<string, GoneSite>;
  raidDone: Record<string, true>;
  spentPays: Record<string, true>;
  claims: Record<string, string>;
  guilds: Record<string, Guild>;
  memberOf: Record<string, string>;
  guildBanUntil: Record<string, number>;
  /** 阵亡人物卡永久销毁，折叠历史时不得复活。 */
  fallen: Record<string, { name: string; owner: string; at: number }>;
  simAt: number;
  digest: string;
}

export interface WorldCheckpoint {
  lastKey: string;
  lastTime: number;
  world: World;
}
