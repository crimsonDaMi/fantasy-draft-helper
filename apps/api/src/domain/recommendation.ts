import {
  Player,
} from "./player.js";

import {
  Ranking,
} from "./ranking.js";

export interface Recommendation {
  ranking: Ranking;

  player: Player;
}