import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MAX_ANNOUNCEMENT_LENGTH, readAnnouncement } from "./announcement.js";

describe("readAnnouncement", () => {
  let directory: string;
  let path: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-ann-"));
    path = join(directory, "announcement.txt");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("returns null when the file doesn't exist", async () => {
    expect(await readAnnouncement(path)).toBeNull();
  });

  it("returns null for an empty or whitespace-only file", async () => {
    writeFileSync(path, "");
    expect(await readAnnouncement(path)).toBeNull();

    writeFileSync(path, "  \n\t\n");
    expect(await readAnnouncement(path)).toBeNull();
  });

  it("returns the message, trimmed", async () => {
    writeFileSync(path, "  Maintenance Sunday 03:00 UTC\n");

    expect(await readAnnouncement(path)).toBe("Maintenance Sunday 03:00 UTC");
  });

  it("cuts an over-long message to the maximum length", async () => {
    writeFileSync(path, "x".repeat(MAX_ANNOUNCEMENT_LENGTH + 100));

    const message = await readAnnouncement(path);

    expect(message).toHaveLength(MAX_ANNOUNCEMENT_LENGTH);
    expect(message?.endsWith("…")).toBe(true);
  });

  it("rethrows errors other than a missing file", async () => {
    // A directory can't be read as a file.
    await expect(readAnnouncement(directory)).rejects.toThrow();
  });
});
