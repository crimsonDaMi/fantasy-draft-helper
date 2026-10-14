import { scryptSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashNewPassword, verifyStoredPassword } from "./password-hash.js";

const FAST_COST = { log2N: 10, r: 8, p: 1 };
const PASSWORD = "correct horse battery";

describe("password hashes", () => {
  it("stores the cost with the hash and verifies the password", async () => {
    const { salt, hash } = await hashNewPassword(PASSWORD, FAST_COST);

    expect(hash).toMatch(/^scrypt\$10\$8\$1\$[0-9a-f]{128}$/);
    await expect(
      verifyStoredPassword(PASSWORD, salt, hash, FAST_COST),
    ).resolves.toEqual({ matches: true, needsRehash: false });
  });

  it("rejects a wrong password", async () => {
    const { salt, hash } = await hashNewPassword(PASSWORD, FAST_COST);

    await expect(
      verifyStoredPassword("wrong password", salt, hash, FAST_COST),
    ).resolves.toEqual({ matches: false, needsRehash: false });
  });

  it("asks for a rehash of a password stored at another cost", async () => {
    const { salt, hash } = await hashNewPassword(PASSWORD, FAST_COST);

    await expect(
      verifyStoredPassword(PASSWORD, salt, hash, { ...FAST_COST, log2N: 11 }),
    ).resolves.toEqual({ matches: true, needsRehash: true });
  });

  it("verifies a legacy hash stored as plain hex at Node's default cost", async () => {
    const salt = "legacy-salt";
    const legacyHash = scryptSync(PASSWORD, salt, 64).toString("hex");

    await expect(
      verifyStoredPassword(PASSWORD, salt, legacyHash, FAST_COST),
    ).resolves.toEqual({ matches: true, needsRehash: true });
  });
});
