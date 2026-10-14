import { describe, expect, it } from "vitest";

import type { RankingPlayerDto } from "../types/api";
import { buildPrintTiers } from "./ranking-print";

const ranked = (
  rank: number,
  tier: string | undefined,
  sleeperId: string,
  position: string,
): RankingPlayerDto => ({
  ranking: { rank, playerName: `Csv ${sleeperId}`, tier },
  player: { sleeperId, fullName: `Player ${sleeperId}`, position, team: "AAA" },
  method: "SLEEPER_ID",
});

describe("buildPrintTiers", () => {
  it("groups players by tier in tier order, sorted by rank", () => {
    const tiers = buildPrintTiers({
      players: [
        ranked(3, "A", "3", "WR"),
        ranked(1, "S", "1", "RB"),
        ranked(2, "S", "2", "WR"),
      ],
      tiers: [
        { label: "A", position: 2, playerCount: 1 },
        { label: "S", position: 1, playerCount: 2 },
      ],
      flags: {},
    });

    expect(tiers.map((tier) => [tier.label, tier.position])).toEqual([
      ["S", 1],
      ["A", 2],
    ]);
    expect(tiers[0].rows.map((row) => row.name)).toEqual([
      "Player 1",
      "Player 2",
    ]);
  });

  it("numbers positions across the whole ranking", () => {
    const [tier] = buildPrintTiers({
      players: [
        ranked(1, "S", "1", "WR"),
        ranked(2, "S", "2", "RB"),
        ranked(3, "S", "3", "WR"),
      ],
      tiers: [{ label: "S", position: 1, playerCount: 3 }],
      flags: {},
    });

    expect(tier.rows.map((row) => row.position)).toEqual(["WR1", "RB1", "WR2"]);
  });

  it("keeps an unmatched row's place, with its CSV data", () => {
    const [tier] = buildPrintTiers({
      players: [
        ranked(1, "S", "1", "WR"),
        {
          ranking: {
            rank: 2,
            playerName: "Unknown Player",
            position: "WR",
            team: "BBB",
            tier: "S",
          },
          method: "UNMATCHED",
        },
        ranked(3, "S", "3", "WR"),
      ],
      tiers: [{ label: "S", position: 1, playerCount: 3 }],
      flags: {},
    });

    expect(tier.rows[1]).toMatchObject({
      name: "Unknown Player",
      team: "BBB",
      position: "WR2",
    });
    expect(tier.rows[2].position).toBe("WR3");
  });

  it("carries flags, notes and bye weeks", () => {
    const player = ranked(1, "S", "1", "WR");
    player.ranking.note = "target share up";
    player.ranking.bye = 7;

    const [tier] = buildPrintTiers({
      players: [player],
      tiers: [{ label: "S", position: 1, playerCount: 1 }],
      flags: { "1": "watch" },
    });

    expect(tier.rows[0]).toMatchObject({
      flag: "watch",
      note: "target share up",
      bye: 7,
    });
  });

  it("leaves out empty tiers and puts untiered players in one group", () => {
    expect(
      buildPrintTiers({
        players: [ranked(1, undefined, "1", "WR")],
        tiers: [],
        flags: {},
      }),
    ).toEqual([
      {
        label: undefined,
        position: undefined,
        rows: [expect.objectContaining({ name: "Player 1" })],
      },
    ]);
    expect(
      buildPrintTiers({
        players: [ranked(1, "S", "1", "WR")],
        tiers: [
          { label: "S", position: 1, playerCount: 1 },
          { label: "A", position: 2, playerCount: 0 },
        ],
        flags: {},
      }).map((tier) => tier.label),
    ).toEqual(["S"]);
  });
});
