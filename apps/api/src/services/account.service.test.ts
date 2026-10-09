import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { AccountService } from "./account.service.js";
import { AuthService } from "./auth.service.js";
import { PlayerMatch } from "../domain/player-match.js";
import { RankingRepository } from "../repositories/ranking.repository.js";
import { UserRepository } from "../repositories/user.repository.js";

// Keeps password hashing fast; production uses the OWASP cost.
const FAST_SCRYPT_COST = { log2N: 10, r: 8, p: 1 };
const PASSWORD = "correct horse battery";
const CLIENT_IP = "192.0.2.1";
const DAY_MS = 24 * 60 * 60 * 1000;
const silentLogger = { info: () => {} } as never;

const MATCHES: PlayerMatch[] = [
  {
    ranking: { rank: 1, playerName: "Player One", team: "BUF", position: "QB" },
    method: "NONE",
  },
];

/** Users and rankings in separate files, as with AUTH_DATABASE_PATH and
 * RANKINGS_DATABASE_PATH, so no foreign key can do the deleting. */
function createSetup(retentionDays = 730) {
  const directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-acct-"));
  const usersPath = join(directory, "users.db");
  const rankingsPath = join(directory, "rankings.db");
  const userRepository = new UserRepository(usersPath, FAST_SCRYPT_COST);
  const rankingRepository = new RankingRepository(rankingsPath);
  const authService = new AuthService(userRepository, [], true);
  const accountService = new AccountService(
    authService,
    userRepository,
    rankingRepository,
    retentionDays,
    silentLogger,
  );

  async function createUserWithData(username: string) {
    const { user, token } = await authService.register(
      username,
      PASSWORD,
      CLIENT_IP,
    );
    const rankingId = rankingRepository.create(MATCHES, user.id);
    rankingRepository.setFlag(rankingId, "1234", "watch");
    return { user, token, rankingId };
  }

  function countRows(table: string, column: string, value: string): number {
    const path =
      table === "users" || table === "sessions" ? usersPath : rankingsPath;
    const database = new DatabaseSync(path);
    const row = database
      .prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`)
      .get(value) as { count: number };
    database.close();
    return row.count;
  }

  function countUserData(userId: string, rankingId: string): number[] {
    return [
      countRows("users", "id", userId),
      countRows("sessions", "user_id", userId),
      countRows("rankings", "user_id", userId),
      countRows("ranking_players", "ranking_id", rankingId),
      countRows("ranking_tiers", "ranking_id", rankingId),
      countRows("ranking_player_flags", "ranking_id", rankingId),
    ];
  }

  function cleanUp() {
    userRepository.close();
    rankingRepository.close();
    rmSync(directory, { recursive: true, force: true });
  }

  return {
    authService,
    accountService,
    createUserWithData,
    countUserData,
    cleanUp,
  };
}

describe("AccountService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("deleteAccount", () => {
    it("deletes the user and everything tied to them, and nothing else", async () => {
      const setup = createSetup();
      const alice = await setup.createUserWithData("alice");
      const bob = await setup.createUserWithData("bob");
      const bobBefore = setup.countUserData(bob.user.id, bob.rankingId);
      expect(
        setup.countUserData(alice.user.id, alice.rankingId).every((n) => n > 0),
      ).toBe(true);

      await setup.accountService.deleteAccount(alice.user, PASSWORD, CLIENT_IP);

      expect(setup.countUserData(alice.user.id, alice.rankingId)).toEqual([
        0, 0, 0, 0, 0, 0,
      ]);
      expect(setup.countUserData(bob.user.id, bob.rankingId)).toEqual(
        bobBefore,
      );
      expect(setup.authService.getUserForSession(alice.token)).toBeUndefined();

      setup.cleanUp();
    });

    it("lets the username register again afterwards", async () => {
      const setup = createSetup();
      const alice = await setup.createUserWithData("alice");

      await setup.accountService.deleteAccount(alice.user, PASSWORD, CLIENT_IP);

      await expect(
        setup.authService.register("alice", PASSWORD, "192.0.2.2"),
      ).resolves.toMatchObject({ user: { username: "alice" } });

      setup.cleanUp();
    });

    it("deletes nothing for a wrong password, and counts it toward the lockout", async () => {
      const setup = createSetup();
      const alice = await setup.createUserWithData("alice");
      const before = setup.countUserData(alice.user.id, alice.rankingId);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await expect(
          setup.accountService.deleteAccount(
            alice.user,
            "wrong password",
            CLIENT_IP,
          ),
        ).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
      }

      await expect(
        setup.accountService.deleteAccount(alice.user, PASSWORD, CLIENT_IP),
      ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
      expect(setup.countUserData(alice.user.id, alice.rankingId)).toEqual(
        before,
      );

      setup.cleanUp();
    });
  });

  describe("purgeInactiveAccounts", () => {
    it("deletes accounts unused for longer than the retention period", async () => {
      const setup = createSetup(30);
      const alice = await setup.createUserWithData("alice");

      expect(
        setup.accountService.purgeInactiveAccounts(
          new Date(Date.now() + 29 * DAY_MS),
        ),
      ).toBe(0);
      expect(
        setup.accountService.purgeInactiveAccounts(
          new Date(Date.now() + 31 * DAY_MS),
        ),
      ).toBe(1);
      expect(setup.countUserData(alice.user.id, alice.rankingId)).toEqual([
        0, 0, 0, 0, 0, 0,
      ]);

      setup.cleanUp();
    });

    it("keeps accounts whose sessions are in use", async () => {
      const setup = createSetup(30);
      const alice = await setup.createUserWithData("alice");
      const bob = await setup.createUserWithData("bob");

      // Alice uses the app on day 20; Bob doesn't.
      vi.useFakeTimers({ now: Date.now() + 20 * DAY_MS, toFake: ["Date"] });
      setup.authService.getUserForSession(alice.token);

      expect(
        setup.accountService.purgeInactiveAccounts(
          new Date(Date.now() + 15 * DAY_MS),
        ),
      ).toBe(1);
      expect(setup.countUserData(alice.user.id, alice.rankingId)[0]).toBe(1);
      expect(setup.countUserData(bob.user.id, bob.rankingId)[0]).toBe(0);

      setup.cleanUp();
    });

    it("keeps accounts that log in again", async () => {
      const setup = createSetup(30);
      const alice = await setup.createUserWithData("alice");

      vi.useFakeTimers({ now: Date.now() + 25 * DAY_MS, toFake: ["Date"] });
      await setup.authService.login("alice", PASSWORD, CLIENT_IP);

      expect(
        setup.accountService.purgeInactiveAccounts(
          new Date(Date.now() + 10 * DAY_MS),
        ),
      ).toBe(0);
      expect(setup.countUserData(alice.user.id, alice.rankingId)[0]).toBe(1);

      setup.cleanUp();
    });

    it("never deletes anything with a retention of 0", async () => {
      const setup = createSetup(0);
      await setup.createUserWithData("alice");

      expect(
        setup.accountService.purgeInactiveAccounts(
          new Date(Date.now() + 10_000 * DAY_MS),
        ),
      ).toBe(0);

      setup.cleanUp();
    });
  });
});
