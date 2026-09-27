import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_PATH = resolve(
  process.cwd(),
  "data",
  "fantasy-draft-helper.db",
);

export class SchemaMismatchError extends Error {}

export function openDatabase(
  databasePath = DEFAULT_DATABASE_PATH,
): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  return new DatabaseSync(databasePath);
}

/**
 * Runs a repository's `CREATE TABLE IF NOT EXISTS` schema, first refusing
 * to start against a database whose existing tables were created by a
 * release with a different schema. There is deliberately no migration
 * system (see RELEASING.md): without this check, `IF NOT EXISTS` silently
 * keeps the old table and the app crashes later with `no such column`.
 *
 * The expected shape comes from applying the same schema to a throwaway
 * in-memory database, so there is no separate version number to keep in
 * sync with the SQL. Tables that don't exist yet are simply created.
 */
export function applySchema(database: DatabaseSync, schemaSql: string): void {
  const expected = new DatabaseSync(":memory:");

  try {
    expected.exec(schemaSql);

    const mismatchedTables = listTables(expected).filter((table) => {
      const actual = describeTable(database, table);

      return actual !== "" && actual !== describeTable(expected, table);
    });

    if (mismatchedTables.length > 0) {
      throw new SchemaMismatchError(
        `Database schema does not match this version of the app ` +
          `(changed tables: ${mismatchedTables.join(", ")}). This release ` +
          `changed the database schema and there is no migration system — ` +
          `delete the database (Docker: \`docker compose down -v\`), then ` +
          `start again, re-register, and re-import your rankings. See ` +
          `RELEASING.md.`,
      );
    }
  } finally {
    expected.close();
  }

  database.exec(schemaSql);
}

function listTables(database: DatabaseSync): string[] {
  const rows = database
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as unknown as { name: string }[];

  return rows.map((row) => row.name);
}

/** Columns and foreign keys of a table, or "" if it doesn't exist. */
function describeTable(database: DatabaseSync, table: string): string {
  const columns = database
    .prepare(`SELECT * FROM pragma_table_info(?) ORDER BY cid`)
    .all(table);

  if (columns.length === 0) {
    return "";
  }

  const foreignKeys = database
    .prepare(`SELECT * FROM pragma_foreign_key_list(?) ORDER BY id, seq`)
    .all(table);

  return JSON.stringify({ columns, foreignKeys });
}
