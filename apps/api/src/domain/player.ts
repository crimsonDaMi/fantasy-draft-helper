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
  /** Seasons in the NFL; 0 for a rookie. */
  yearsExp?: number;
}
