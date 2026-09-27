import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { applySchema, openDatabase, SchemaMismatchError } from "./database.js";

describe("openDatabase", () => {
  it("opens an in-memory database without touching the filesystem", () => {
    const database = openDatabase(":memory:");

    expect(database).toBeDefined();

    database.close();
  });

  it("creates the containing directory for a file-backed database if missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-db-"));

    const nestedPath = join(directory, "nested", "test.db");

    expect(existsSync(join(directory, "nested"))).toBe(false);

    const database = openDatabase(nestedPath);

    expect(existsSync(join(directory, "nested"))).toBe(true);

    database.close();
    rmSync(directory, { recursive: true, force: true });
  });
});

const SCHEMA_V1 = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
`;

const SCHEMA_V2 = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT
  );
`;

describe("applySchema", () => {
  it("creates missing tables on a fresh database", () => {
    const database = openDatabase(":memory:");

    applySchema(database, SCHEMA_V1);

    expect(() =>
      database.prepare(`INSERT INTO items (id, name) VALUES ('1', 'a')`).run(),
    ).not.toThrow();

    database.close();
  });

  it("accepts a database created with the same schema", () => {
    const database = openDatabase(":memory:");

    applySchema(database, SCHEMA_V1);

    expect(() => applySchema(database, SCHEMA_V1)).not.toThrow();

    database.close();
  });

  it("refuses a database whose existing table has a different schema", () => {
    const database = openDatabase(":memory:");

    applySchema(database, SCHEMA_V1);

    expect(() => applySchema(database, SCHEMA_V2)).toThrow(SchemaMismatchError);
    expect(() => applySchema(database, SCHEMA_V2)).toThrow(/items/);

    database.close();
  });

  it("detects a changed foreign key, not just changed columns", () => {
    const database = openDatabase(":memory:");

    const withoutCascade = `
      CREATE TABLE IF NOT EXISTS parents (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES parents(id)
      );
    `;

    applySchema(database, withoutCascade);

    expect(() =>
      applySchema(
        database,
        withoutCascade.replace(
          "REFERENCES parents(id)",
          "REFERENCES parents(id) ON DELETE CASCADE",
        ),
      ),
    ).toThrow(SchemaMismatchError);

    database.close();
  });

  it("ignores tables owned by another schema in the same file", () => {
    const database = openDatabase(":memory:");

    applySchema(database, SCHEMA_V1);

    expect(() =>
      applySchema(
        database,
        `CREATE TABLE IF NOT EXISTS other (id TEXT PRIMARY KEY);`,
      ),
    ).not.toThrow();

    database.close();
  });
});
