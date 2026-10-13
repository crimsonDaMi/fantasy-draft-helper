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

  it("maps age and rookie status, leaving out missing ones", () => {
    const rookie = mapSleeperPlayer({
      player_id: "1",
      full_name: "Player One",
      age: 21,
      years_exp: 0,
    });
    const veteran = mapSleeperPlayer({
      player_id: "3",
      full_name: "Player Three",
      years_exp: 4,
    });
    const unknown = mapSleeperPlayer({
      player_id: "2",
      full_name: "Player Two",
      age: null,
      years_exp: null,
    });

    expect(rookie).toMatchObject({ age: 21, rookie: true });
    expect(veteran.rookie).toBe(false);
    expect(unknown.age).toBeUndefined();
    expect(unknown.rookie).toBeUndefined();
  });
});
