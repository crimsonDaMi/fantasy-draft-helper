import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  migrate,
  Migration,
  openDatabase,
  SchemaMismatchError,
  VersionedSchema,
} from "./database.js";

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

const CREATE_ITEMS: Migration = {
  version: 1,
  up: `CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
};

const ADD_NOTE: Migration = {
  version: 2,
  up: `ALTER TABLE items ADD COLUMN note TEXT`,
};

function itemsSchema(...migrations: Migration[]): VersionedSchema {
  return { name: "items", migrations };
}

function version(database: DatabaseSync, name = "items") {
  return (
    database
      .prepare(`SELECT version FROM schema_versions WHERE schema = ?`)
      .get(name) as { version: number } | undefined
  )?.version;
}

describe("migrate", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function databaseFile() {
    directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-migrate-"));
    return join(directory, "test.db");
  }

  it("builds a fresh database with every step and records its version", () => {
    const database = openDatabase(":memory:");

    migrate(database, itemsSchema(CREATE_ITEMS, ADD_NOTE));

    expect(version(database)).toBe(2);
    expect(() =>
      database
        .prepare(`INSERT INTO items (id, name, note) VALUES ('1', 'a', 'n')`)
        .run(),
    ).not.toThrow();

    database.close();
  });

  it("runs no step twice on the database", () => {
    const database = openDatabase(":memory:");
    const up = vi.fn((db: DatabaseSync) => {
      db.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL)`);
    });
    const schema = itemsSchema({ version: 1, up });

    migrate(database, schema);
    migrate(database, schema);

    // Steps also build throwaway in-memory databases (the expected
    // schema); count only runs against this one.
    expect(up.mock.calls.filter(([db]) => db === database)).toHaveLength(1);

    database.close();
  });

  it("upgrades an older file in place, keeping its data and a backup", () => {
    const path = databaseFile();
    const old = openDatabase(path);
    migrate(old, itemsSchema(CREATE_ITEMS), path);
    old.prepare(`INSERT INTO items (id, name) VALUES ('1', 'kept')`).run();
    old.close();

    const database = openDatabase(path);
    migrate(database, itemsSchema(CREATE_ITEMS, ADD_NOTE), path);

    expect(version(database)).toBe(2);
    expect(database.prepare(`SELECT * FROM items`).all()).toEqual([
      { id: "1", name: "kept", note: null },
    ]);
    database.close();

    const backups = readdirSync(directory!).filter((file) =>
      file.startsWith("test.db.backup-v1-"),
    );
    expect(backups).toHaveLength(1);
    const backup = new DatabaseSync(join(directory!, backups[0]!));
    expect(version(backup)).toBe(1);
    expect(backup.prepare(`SELECT * FROM items`).all()).toEqual([
      { id: "1", name: "kept" },
    ]);
    backup.close();
  });

  it("rolls a failing step back completely", () => {
    const database = openDatabase(":memory:");
    migrate(database, itemsSchema(CREATE_ITEMS));

    const failing: Migration = {
      version: 2,
      up: `ALTER TABLE items ADD COLUMN note TEXT; SELECT * FROM missing_table;`,
    };

    expect(() => migrate(database, itemsSchema(CREATE_ITEMS, failing))).toThrow(
      /missing_table/,
    );
    expect(version(database)).toBe(1);
    expect(
      database.prepare(`SELECT name FROM pragma_table_info('items')`).all(),
    ).toEqual([{ name: "id" }, { name: "name" }]);

    database.close();
  });

  it("refuses a database newer than the app", () => {
    const database = openDatabase(":memory:");
    migrate(database, itemsSchema(CREATE_ITEMS, ADD_NOTE));

    expect(() => migrate(database, itemsSchema(CREATE_ITEMS))).toThrow(
      /version 2, newer than this version of the app knows \(1\)/,
    );

    database.close();
  });

  it("adopts unversioned tables that match the baseline", () => {
    const database = openDatabase(":memory:");
    database.exec(
      `CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL)`,
    );

    migrate(database, itemsSchema(CREATE_ITEMS, ADD_NOTE));

    expect(version(database)).toBe(2);

    database.close();
  });

  it("refuses unversioned tables that don't match the baseline", () => {
    const database = openDatabase(":memory:");
    database.exec(`CREATE TABLE items (id TEXT PRIMARY KEY, title TEXT)`);

    expect(() => migrate(database, itemsSchema(CREATE_ITEMS))).toThrow(
      SchemaMismatchError,
    );
    expect(() => migrate(database, itemsSchema(CREATE_ITEMS))).toThrow(
      /changed tables: items.*before v3\.0\.0/,
    );

    database.close();
  });

  it("detects a step that changed after it shipped", () => {
    const database = openDatabase(":memory:");
    migrate(database, itemsSchema(CREATE_ITEMS));

    const edited: Migration = {
      version: 1,
      up: `CREATE TABLE items (id TEXT PRIMARY KEY, name TEXT NOT NULL, extra TEXT)`,
    };

    expect(() => migrate(database, itemsSchema(edited))).toThrow(
      /must never change/,
    );

    database.close();
  });

  it("keeps the versions of two schemas in one file apart", () => {
    const database = openDatabase(":memory:");
    const others: VersionedSchema = {
      name: "others",
      migrations: [
        { version: 1, up: `CREATE TABLE others (id TEXT PRIMARY KEY)` },
      ],
    };

    migrate(database, itemsSchema(CREATE_ITEMS, ADD_NOTE));
    migrate(database, others);

    expect(version(database, "items")).toBe(2);
    expect(version(database, "others")).toBe(1);

    database.close();
  });

  it("rebuilds a referenced table with foreign keys off, then checks them", () => {
    const database = openDatabase(":memory:");
    const base: Migration = {
      version: 1,
      up: `
        CREATE TABLE parents (id TEXT PRIMARY KEY, name TEXT);
        CREATE TABLE children (
          id TEXT PRIMARY KEY,
          parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE
        );
      `,
    };
    migrate(database, { name: "family", migrations: [base] });
    database.exec(`
      INSERT INTO parents VALUES ('p', 'Parent');
      INSERT INTO children VALUES ('c', 'p');
    `);

    // Make parents.name NOT NULL, which needs a table rebuild in SQLite.
    const rebuild: Migration = {
      version: 2,
      rebuildsTables: true,
      up: `
        CREATE TABLE parents_new (id TEXT PRIMARY KEY, name TEXT NOT NULL);
        INSERT INTO parents_new SELECT id, name FROM parents;
        DROP TABLE parents;
        ALTER TABLE parents_new RENAME TO parents;
      `,
    };
    migrate(database, { name: "family", migrations: [base, rebuild] });

    expect(database.prepare(`SELECT * FROM children`).all()).toEqual([
      { id: "c", parent_id: "p" },
    ]);
    expect(
      (
        database.prepare(`PRAGMA foreign_keys`).get() as {
          foreign_keys: number;
        }
      ).foreign_keys,
    ).toBe(1);

    database.close();
  });

  it("rolls back a rebuild that leaves broken foreign keys", () => {
    const database = openDatabase(":memory:");
    const base: Migration = {
      version: 1,
      up: `
        CREATE TABLE parents (id TEXT PRIMARY KEY);
        CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id));
      `,
    };
    migrate(database, { name: "family", migrations: [base] });
    database.exec(`
      INSERT INTO parents VALUES ('p');
      INSERT INTO children VALUES ('c', 'p');
    `);

    const dropsParents: Migration = {
      version: 2,
      rebuildsTables: true,
      up: `DELETE FROM parents`,
    };

    expect(() =>
      migrate(database, { name: "family", migrations: [base, dropsParents] }),
    ).toThrow(/broke foreign keys/);
    expect(database.prepare(`SELECT * FROM parents`).all()).toEqual([
      { id: "p" },
    ]);

    database.close();
  });

  it("rejects steps that aren't numbered 1, 2, 3, ...", () => {
    const database = openDatabase(":memory:");

    expect(() =>
      migrate(database, itemsSchema(CREATE_ITEMS, { ...ADD_NOTE, version: 3 })),
    ).toThrow(/numbered 1, 2, 3/);

    database.close();
  });
});
