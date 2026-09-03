import {
  Ranking,
} from "./ranking.js";

export interface RankingImportError {
  row: number;

  message: string;
}

export interface RankingImportResult {
  rankings: Ranking[];

  errors: RankingImportError[];
}