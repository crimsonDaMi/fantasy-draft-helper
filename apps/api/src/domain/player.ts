export interface Player {
  sleeperId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  team?: string;
  status?: string;
  injuryStatus?: string;
  active: boolean;
  fantasyPositions: string[];
  age?: number;
  /** Undefined when Sleeper doesn't know the player's experience. */
  rookie?: boolean;
  /** Place on the NFL team's depth chart; omitted when Sleeper has none. */
  depthChart?: DepthChart;
  /** When Sleeper last had news on the player (epoch ms). Sleeper keeps
   * many long-retired players `active`; stale news gives them away. */
  lastNewsAt?: number;
  /** Sleeper's relevance order, 1 = most relevant. */
  searchRank?: number;
}

export interface DepthChart {
  /** e.g. `RB`; receivers are split into `LWR`, `RWR`, `SWR`. */
  position: string;
  /** 1 for the starter. */
  order: number;
}
