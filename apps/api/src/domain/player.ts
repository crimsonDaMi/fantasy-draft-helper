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
}
