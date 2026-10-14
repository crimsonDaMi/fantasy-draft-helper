import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecommendationsList } from "./RecommendationsList";

describe("RecommendationsList", () => {
  afterEach(cleanup);

  it("shows the position in its own badge, not in the meta line", () => {
    const { container } = render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 1,
            tier: "S",
            player: {
              sleeperId: "1",
              fullName: "Player One",
              position: "QB",
              team: "AAA",
            },
          },
          {
            rank: 2,
            player: {
              sleeperId: "2",
              fullName: "Player Two",
              position: "WR",
              team: "BBB",
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("QB")).toHaveClass("position-badge--qb");
    expect(screen.getByText("WR")).toHaveClass("position-badge--wr");
    expect(container.querySelector(".hero__meta")).toHaveTextContent(
      /^AAA · Tier S$/,
    );
    expect(container.querySelector(".rec-list__meta")).toHaveTextContent(
      /^BBB$/,
    );
  });

  it("labels positional ranks, by ADP only when ADP exists", () => {
    const { container } = render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 20,
            positionRank: 12,
            tier: "B",
            bye: 7,
            player: {
              sleeperId: "1",
              fullName: "Player One",
              position: "WR",
              team: "AAA",
            },
            adp: { value: 25, diff: -5, positionRank: 15 },
          },
          {
            rank: 21,
            positionRank: 8,
            player: {
              sleeperId: "2",
              fullName: "Player Two",
              position: "RB",
              team: "BBB",
            },
          },
        ]}
      />,
    );

    expect(container.querySelector(".hero__meta")).toHaveTextContent(
      /^AAA · WR12 · Tier B · Bye 7 · ▲ 5.0 ADP · ADP WR15$/,
    );
    expect(container.querySelector(".rec-list__meta")).toHaveTextContent(
      /^BBB · RB8$/,
    );
  });

  it("reveals the legend on tap, without watch/avoid when flags are off", () => {
    render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 1,
            player: {
              sleeperId: "1",
              fullName: "Player One",
              position: "QB",
              team: "AAA",
            },
          },
        ]}
      />,
    );

    const button = screen.getByRole("button", {
      name: "About these recommendations",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/injured reserve/)).not.toBeInTheDocument();

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/injured reserve/)).toBeInTheDocument();
    expect(screen.getByText(/ADP is SF ADP/)).toBeInTheDocument();
    expect(screen.queryByText(/watch a player/)).not.toBeInTheDocument();
  });

  it("shows age and a rookie badge only where Sleeper has the data", () => {
    const { container } = render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 1,
            player: {
              sleeperId: "1",
              fullName: "Player One",
              team: "AAA",
              age: 21,
              rookie: true,
            },
          },
          {
            rank: 2,
            player: {
              sleeperId: "2",
              fullName: "Player Two",
              team: "BBB",
              age: 29,
              rookie: false,
            },
          },
          {
            rank: 3,
            player: { sleeperId: "3", fullName: "Player Three", team: "CCC" },
          },
        ]}
      />,
    );

    expect(container.querySelector(".hero__meta")).toHaveTextContent(
      /^AAA · Age 21$/,
    );
    expect(container.querySelector(".hero__title")).toContainElement(
      screen.getByLabelText("Rookie"),
    );
    const metas = container.querySelectorAll(".rec-list__meta");
    expect(metas[0]).toHaveTextContent(/^BBB · Age 29$/);
    expect(metas[1]).toHaveTextContent(/^CCC$/);
    expect(screen.getAllByLabelText("Rookie")).toHaveLength(1);
  });

  it("shows the top pick's note and reveals others' notes on tap", () => {
    const { container } = render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 1,
            note: "Injury risk",
            player: { sleeperId: "1", fullName: "Player One" },
          },
          {
            rank: 2,
            note: "New OC, target share up",
            player: { sleeperId: "2", fullName: "Player Two" },
          },
          { rank: 3, player: { sleeperId: "3", fullName: "Player Three" } },
        ]}
      />,
    );

    expect(container.querySelector(".hero__note")).toHaveTextContent(
      "Injury risk",
    );
    // Only the row with a note gets a toggle.
    expect(
      screen.queryByRole("button", { name: "Note on Player Three" }),
    ).toBeNull();
    expect(screen.queryByText("New OC, target share up")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Note on Player Two" }));

    expect(screen.getByText("New OC, target share up")).toBeInTheDocument();
  });

  it("marks only players flagged as last in their tier", () => {
    const { container } = render(
      <RecommendationsList
        adpFormat="SF"
        recommendations={[
          {
            rank: 1,
            tier: "A",
            player: { sleeperId: "1", fullName: "Player One", position: "RB" },
          },
          {
            rank: 2,
            tier: "A",
            lastInTier: true,
            player: {
              sleeperId: "2",
              fullName: "Player Two",
              position: "WR",
              team: "BBB",
            },
          },
        ]}
      />,
    );

    expect(screen.getAllByLabelText("Last WR left in tier A")).toHaveLength(1);
    expect(container.querySelector(".rec-list__meta")).toHaveTextContent(
      /^BBB · Tier A Last$/,
    );
  });

  it("tags players who stack with the user's picks", () => {
    render(
      <RecommendationsList
        adpFormat="SF"
        myPicks={[
          {
            pickNo: 3,
            playerId: "9",
            playerName: "Player Nine",
            position: "QB",
            team: "AAA",
          },
        ]}
        recommendations={[
          {
            rank: 1,
            player: {
              sleeperId: "1",
              fullName: "Player One",
              position: "WR",
              team: "AAA",
            },
          },
          {
            rank: 2,
            player: {
              sleeperId: "2",
              fullName: "Player Two",
              position: "WR",
              team: "BBB",
            },
          },
        ]}
      />,
    );

    expect(screen.getAllByLabelText("Stacks with Player Nine")).toHaveLength(1);
    expect(screen.getByText("Stack: AAA")).toBeInTheDocument();
  });
});
