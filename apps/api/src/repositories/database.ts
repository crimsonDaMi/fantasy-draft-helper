import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export const DEFAULT_DATABASE_PATH = resolve(
  process.cwd(),
  "data",
  "fantasy-draft-helper.db",
);

export function openDatabase(
  databasePath = DEFAULT_DATABASE_PATH,
): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  return new DatabaseSync(databasePath);
}
