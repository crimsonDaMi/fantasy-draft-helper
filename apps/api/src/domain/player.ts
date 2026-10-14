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
}

export interface DepthChart {
  /** e.g. `RB`; receivers are split into `LWR`, `RWR`, `SWR`. */
  position: string;
  /** 1 for the starter. */
  order: number;
}
