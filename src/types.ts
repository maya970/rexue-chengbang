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
  /** 这块空地已占用的建筑。空地未建则为空。 */
  building?: BuildingId;
  timeMult: number;
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
  | "buy_card";

export type MarchMission = "plunder" | "massacre" | "destroy" | "reinforce" | "colonize" | "scout";

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
  cityId: string;
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

export interface BattleRound {
  title: string;
  text: string;
}

export interface BattleReport {
  id: string;
  time: number;
  title: string;
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
  simAt: number;
  digest: string;
}

export interface WorldCheckpoint {
  lastKey: string;
  lastTime: number;
  world: World;
}
