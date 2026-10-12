import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecentPicks } from "./RecentPicks";

describe("RecentPicks", () => {
  afterEach(cleanup);

  it("labels positional ranks, by ADP only when ADP exists", () => {
    const { container } = render(
      <RecentPicks
        teams={12}
        picks={[
          {
            pickNo: 1,
            playerId: "1",
            playerName: "Player One",
            position: "WR",
            rank: 3,
            positionRank: 2,
            adp: 2.1,
            adpPositionRank: 1,
          },
          {
            pickNo: 2,
            playerId: "2",
            playerName: "Player Two",
            position: "RB",
            rank: 5,
            positionRank: 3,
          },
          {
            pickNo: 3,
            playerId: "3",
            playerName: "Player Three",
            position: "TE",
            adp: 30,
            adpPositionRank: 2,
          },
        ]}
      />,
    );

    expect(
      [...container.querySelectorAll(".recent-picks__rank")].map(
        (rank) => rank.textContent,
      ),
    ).toEqual([
      "unranked · ADP TE2",
      "your #5 · RB3",
      "your #3 · WR2 · ADP WR1",
    ]);
  });
});
