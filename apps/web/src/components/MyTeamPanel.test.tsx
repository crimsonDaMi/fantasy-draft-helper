import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MyTeamPanel } from "./MyTeamPanel";

const draft = { type: "snake", teams: 4, rounds: 3, rosterSlots: { QB: 1 } };

describe("MyTeamPanel", () => {
  afterEach(cleanup);

  it("collapses to the next pick, keeping the slot select in the body", () => {
    const { container } = render(
      <MyTeamPanel
        draft={draft}
        draftStatus="DRAFTING"
        currentPickNo={1}
        slot={1}
        slotFromSleeper={false}
        myPicks={[]}
        onSlotChange={vi.fn()}
        collapsible
      />,
    );

    const details = container.querySelector("details.my-team");
    const summary = container.querySelector("summary");

    expect(details).not.toHaveAttribute("open");
    expect(summary).toHaveTextContent("My team");
    expect(summary).toHaveTextContent("You're on the clock (1.01)");
    expect(summary?.contains(screen.getByRole("combobox"))).toBe(false);
  });

  it("marks a next pick acquired by trade", () => {
    render(
      <MyTeamPanel
        draft={{
          ...draft,
          slotToRosterId: { "1": 11, "2": 12, "3": 13, "4": 14 },
          tradedPicks: [{ round: 2, rosterId: 13, ownerId: 11 }],
        }}
        draftStatus="DRAFTING"
        currentPickNo={2}
        slot={1}
        slotFromSleeper
        myPicks={[]}
        onSlotChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText("You pick in 4 (2.02, traded)"),
    ).toBeInTheDocument();
  });

  it("shows the budget left instead of a next pick in auctions", () => {
    render(
      <MyTeamPanel
        draft={{ ...draft, type: "auction", budget: 200 }}
        draftStatus="DRAFTING"
        currentPickNo={2}
        slot={1}
        slotFromSleeper
        myPicks={[{ pickNo: 1, playerId: "1", position: "QB", amount: 50 }]}
        onSlotChange={vi.fn()}
      />,
    );

    // 2 open spots of 3: one of them needs at least $1.
    expect(
      screen.getByText("$150 of $200 left · max bid $149"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/You pick in/)).not.toBeInTheDocument();
  });
});
