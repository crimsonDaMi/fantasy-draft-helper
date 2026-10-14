import {
  randomBytes,
  scrypt,
  ScryptOptions,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;

export interface ScryptCost {
  log2N: number;
  r: number;
  p: number;
}

// OWASP's minimum for scrypt (128 MiB per hash). Stored with each hash as
// `scrypt$<log2N>$<r>$<p>$<hex>`, so the cost can be raised later without
// invalidating existing passwords.
export const SCRYPT_COST: ScryptCost = { log2N: 17, r: 8, p: 1 };

// Node's scrypt defaults, used for hashes stored as plain hex before the
// cost was recorded alongside the hash. Upgraded on the next login.
const LEGACY_SCRYPT_COST: ScryptCost = { log2N: 14, r: 8, p: 1 };

// Hashed against when the username doesn't exist, so a login attempt takes
// the same time either way and doesn't reveal which usernames are taken.
const DUMMY_SALT = randomBytes(SALT_BYTES).toString("hex");

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

function parseStoredHash(stored: string): { cost: ScryptCost; hash: string } {
  const parts = stored.split("$");

  if (parts.length === 5 && parts[0] === "scrypt") {
    const [, log2N, r, p, hash] = parts;

    return {
      cost: { log2N: Number(log2N), r: Number(r), p: Number(p) },
      hash,
    };
  }

  return { cost: LEGACY_SCRYPT_COST, hash: stored };
}

function formatStoredHash(cost: ScryptCost, hash: string): string {
  return `scrypt$${cost.log2N}$${cost.r}$${cost.p}$${hash}`;
}

function isSameCost(a: ScryptCost, b: ScryptCost): boolean {
  return a.log2N === b.log2N && a.r === b.r && a.p === b.p;
}

/** Async so a login doesn't block the event loop (and every other
 * user's draft polling) for the duration of the hash. */
async function hashPassword(
  password: string,
  salt: string,
  cost: ScryptCost,
): Promise<string> {
  const N = 2 ** cost.log2N;
  const hash = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N,
    r: cost.r,
    p: cost.p,
    // Node rejects anything above 32 MiB by default; scrypt needs
    // 128 * N * r bytes, plus headroom.
    maxmem: 2 * 128 * N * cost.r,
  });

  return hash.toString("hex");
}

/** A fresh salt and the hash to store for `password` at `cost`. */
export async function hashNewPassword(
  password: string,
  cost: ScryptCost,
): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = formatStoredHash(cost, await hashPassword(password, salt, cost));

  return { salt, hash };
}

/**
 * Whether `password` matches a stored salt and hash. `needsRehash` is
 * set when it matches a hash stored at another cost than `cost`, so the
 * caller can store a new one while it has the password.
 */
export async function verifyStoredPassword(
  password: string,
  salt: string,
  storedHash: string,
  cost: ScryptCost,
): Promise<{ matches: boolean; needsRehash: boolean }> {
  const stored = parseStoredHash(storedHash);
  const expected = Buffer.from(stored.hash, "hex");
  const candidate = Buffer.from(
    await hashPassword(password, salt, stored.cost),
    "hex",
  );
  const matches =
    expected.length === candidate.length &&
    timingSafeEqual(expected, candidate);

  return { matches, needsRehash: matches && !isSameCost(stored.cost, cost) };
}

/** Takes as long as checking a real password, for a username that
 * doesn't exist. */
export async function hashDummyPassword(
  password: string,
  cost: ScryptCost,
): Promise<void> {
  await hashPassword(password, DUMMY_SALT, cost);
}
