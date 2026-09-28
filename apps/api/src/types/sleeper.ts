export interface SleeperDraft {
  draft_id: string;
  status: string;
  sport: string;
  season: string;
  type?: string;
  league_id?: string;
  start_time?: number | null;
  last_picked?: number | null;
  last_message_time?: number | null;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  draft_order?: Record<string, number> | null;
}

export interface SleeperUser {
  user_id: string;
  username?: string;
  display_name?: string;
}

export interface SleeperDraftPick {
  player_id?: string;
  picked_by?: string;
  roster_id?: number | string;
  round?: number;
  draft_slot?: number;
  pick_no: number;
  draft_id?: string;
  is_keeper?: boolean | null;
  metadata?: {
    first_name?: string;
    last_name?: string;
    team?: string;
    position?: string;
    player_id?: string;
  };
}

export interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  status?: string | null;
  injury_status?: string | null;
  active?: boolean;
  sport?: string;
  fantasy_positions?: string[] | null;
}

export type SleeperPlayersResponse = Record<string, SleeperPlayer>;
