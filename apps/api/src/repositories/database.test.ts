import {
  describe,
  expect,
  it,
} from "vitest";

import {
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  openDatabase,
} from "./database.js";

describe(
  "openDatabase",

  () => {
    it(
      "opens an in-memory database without touching the filesystem",

      () => {
        const database = openDatabase(":memory:");

        expect(database).toBeDefined();

        database.close();
      },
    );

    it(
      "creates the containing directory for a file-backed database if missing",

      () => {
        const directory = mkdtempSync(
          join(tmpdir(), "fantasy-draft-helper-db-"),
        );

        const nestedPath = join(
          directory,
          "nested",
          "test.db",
        );

        expect(existsSync(join(directory, "nested"))).toBe(false);

        const database = openDatabase(nestedPath);

        expect(existsSync(join(directory, "nested"))).toBe(true);

        database.close();
        rmSync(directory, { recursive: true, force: true });
      },
    );
  },
);