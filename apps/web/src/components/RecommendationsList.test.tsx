import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecommendationsList } from "./RecommendationsList";

describe("RecommendationsList", () => {
  afterEach(cleanup);

  it("shows the position in its own badge, not in the meta line", () => {
    const { container } = render(
      <RecommendationsList
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

  it("reveals the legend on tap, without watch/avoid when flags are off", () => {
    render(
      <RecommendationsList
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
    expect(screen.queryByText(/watch a player/)).not.toBeInTheDocument();
  });
});
