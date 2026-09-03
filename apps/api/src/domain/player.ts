export interface Player {
  sleeperId: string;

  fullName: string;

  firstName?: string;

  lastName?: string;

  position?: string;

  team?: string;

  status?: string;

  active: boolean;

  fantasyPositions: string[];
}