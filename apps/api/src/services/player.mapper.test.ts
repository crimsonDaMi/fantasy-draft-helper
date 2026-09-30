import { describe, expect, it } from "vitest";

import { mapSleeperPlayer } from "./player.mapper.js";

describe("mapSleeperPlayer", () => {
  it("builds a team defense's name from first and last name", () => {
    // A /players/nfl team defense entry: no full_name, team abbreviation ID.
    const player = mapSleeperPlayer({
      player_id: "KC",
      first_name: "Kansas City",
      last_name: "Chiefs",
      position: "DEF",
      team: "KC",
      active: true,
      fantasy_positions: ["DEF"],
    });

    expect(player).toMatchObject({
      sleeperId: "KC",
      fullName: "Kansas City Chiefs",
      position: "DEF",
      team: "KC",
    });
  });
});
