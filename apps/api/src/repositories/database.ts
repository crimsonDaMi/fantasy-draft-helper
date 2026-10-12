import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_DATABASE_PATH = resolve(
  process.cwd(),
  "data",
  "fantasy-draft-helper.db",
);

export class SchemaMismatchError extends Error {}

/** The configured path, or the default file under the API's working
 * directory. */
export function resolveDatabasePath(databasePath?: string): string {
  return databasePath ?? DEFAULT_DATABASE_PATH;
}

export function openDatabase(
  databasePath = DEFAULT_DATABASE_PATH,
): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);

  // Per connection, and a no-op inside a transaction, where migration
  // steps run, so it's set here rather than in a schema.
  database.exec("PRAGMA foreign_keys = ON");

  return database;
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export function runInTransaction(database: DatabaseSync, fn: () => void): void {
  database.exec("BEGIN");

  try {
    fn();
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** One schema change, applied once, in order, in a transaction. */
export interface Migration {
  /** 1 for the baseline, then 2, 3, ... with no gaps. */
  version: number;
  /** SQL, or a function for changes that also move data. A function
   * also runs on empty throwaway databases (to learn the expected
   * schema), so it must cope with having no rows. */
  up: string | ((database: DatabaseSync) => void);
  /** For a step that rebuilds a table (SQLite can't alter most column
   * definitions in place): foreign keys are off while it runs and
   * checked afterwards. */
  rebuildsTables?: boolean;
}

/** A repository's tables and the steps that build them. */
export interface VersionedSchema {
  /** Key in `schema_versions`; schemas may share a database file. */
  name: string;
  migrations: Migration[];
}

const VERSIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_versions (
    schema TEXT PRIMARY KEY,
    version INTEGER NOT NULL
  )
`;

/**
 * Brings `schema` up to its latest version at startup:
 *
 * - A fresh database gets every step.
 * - A database at an older version gets the pending steps, after a
 *   backup copy (`<file>.backup-v<version>-<time>`) when it's a file.
 * - Tables without a recorded version (created before versions were
 *   tracked) are adopted as version 1 if they match it exactly. Anything
 *   else predates v3.0.0, which needs a one-time reset.
 * - A database newer than the app (after a downgrade) is refused.
 *
 * Finally the tables must match what the steps produce, which catches a
 * step edited after it shipped.
 */
export function migrate(
  database: DatabaseSync,
  schema: VersionedSchema,
  databasePath?: string,
): void {
  const latest = assertOrderedSteps(schema);

  database.exec(VERSIONS_TABLE);

  let current = readVersion(database, schema.name);

  if (current === undefined) {
    current = adoptUnversionedTables(database, schema);
  }

  if (current > latest) {
    throw new SchemaMismatchError(
      `The "${schema.name}" database is at version ${current}, newer than ` +
        `this version of the app knows (${latest}). Downgrading isn't ` +
        `supported: run the newer release, or restore a backup.`,
    );
  }

  const pending = schema.migrations.filter((step) => step.version > current);

  if (pending.length > 0 && current > 0 && databasePath !== undefined) {
    backUp(database, databasePath, current);
  }

  for (const step of pending) {
    applyStep(database, schema.name, step);
  }

  assertMatchesSteps(database, schema, latest);
}

function assertOrderedSteps(schema: VersionedSchema): number {
  schema.migrations.forEach((step, index) => {
    if (step.version !== index + 1) {
      throw new Error(
        `"${schema.name}" migration steps must be numbered 1, 2, 3, ... ` +
          `in order; found ${step.version} at position ${index + 1}.`,
      );
    }
  });

  return schema.migrations.length;
}

function readVersion(database: DatabaseSync, name: string): number | undefined {
  const row = database
    .prepare(`SELECT version FROM schema_versions WHERE schema = ?`)
    .get(name) as unknown as { version: number } | undefined;

  return row?.version;
}

function writeVersion(
  database: DatabaseSync,
  name: string,
  version: number,
): void {
  database
    .prepare(
      `INSERT INTO schema_versions (schema, version) VALUES (?, ?)
       ON CONFLICT (schema) DO UPDATE SET version = excluded.version`,
    )
    .run(name, version);
}

/** 0 for a database without any of the schema's tables, 1 for tables
 * that match the baseline exactly; refuses anything else. */
function adoptUnversionedTables(
  database: DatabaseSync,
  schema: VersionedSchema,
): number {
  const baseline = buildExpected(schema, 1);

  try {
    const tables = listTables(baseline);
    const existing = tables.filter(
      (table) => describeTable(database, table) !== "",
    );

    if (existing.length === 0) {
      return 0;
    }

    const mismatched = tables.filter(
      (table) =>
        describeTable(database, table) !== describeTable(baseline, table),
    );

    if (mismatched.length > 0) {
      throw new SchemaMismatchError(
        `Database schema does not match this version of the app ` +
          `(changed tables: ${mismatched.join(", ")}). It was created by a ` +
          `release before v3.0.0, which can't be upgraded: delete the ` +
          `database (Docker: \`docker compose down -v\`), then start again, ` +
          `re-register, and re-import your rankings. See RELEASING.md.`,
      );
    }

    writeVersion(database, schema.name, 1);

    return 1;
  } finally {
    baseline.close();
  }
}

/** A consistent copy of the database file next to it, before upgrading. */
function backUp(
  database: DatabaseSync,
  databasePath: string,
  version: number,
): void {
  if (databasePath === ":memory:") {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  database
    .prepare(`VACUUM INTO ?`)
    .run(`${databasePath}.backup-v${version}-${stamp}`);
}

function applyStep(
  database: DatabaseSync,
  name: string,
  step: Migration,
): void {
  if (step.rebuildsTables) {
    database.exec("PRAGMA foreign_keys = OFF");
  }

  try {
    runInTransaction(database, () => {
      runStep(database, step);

      if (step.rebuildsTables) {
        const violations = database.prepare(`PRAGMA foreign_key_check`).all();

        if (violations.length > 0) {
          throw new Error(
            `"${name}" migration step ${step.version} broke foreign keys: ` +
              JSON.stringify(violations),
          );
        }
      }

      writeVersion(database, name, step.version);
    });
  } finally {
    if (step.rebuildsTables) {
      database.exec("PRAGMA foreign_keys = ON");
    }
  }
}

function runStep(database: DatabaseSync, step: Migration): void {
  if (typeof step.up === "string") {
    database.exec(step.up);
  } else {
    step.up(database);
  }
}

/** A throwaway database with the schema's steps up to `version` applied. */
function buildExpected(schema: VersionedSchema, version: number): DatabaseSync {
  const expected = new DatabaseSync(":memory:");

  for (const step of schema.migrations.slice(0, version)) {
    runStep(expected, step);
  }

  return expected;
}

function assertMatchesSteps(
  database: DatabaseSync,
  schema: VersionedSchema,
  latest: number,
): void {
  const expected = buildExpected(schema, latest);

  try {
    const mismatched = listTables(expected).filter(
      (table) =>
        describeTable(database, table) !== describeTable(expected, table),
    );

    if (mismatched.length > 0) {
      throw new SchemaMismatchError(
        `The "${schema.name}" tables (${mismatched.join(", ")}) don't match ` +
          `what migration steps 1-${latest} build. A step that already ` +
          `shipped must never change; add a new step instead.`,
      );
    }
  } finally {
    expected.close();
  }
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
