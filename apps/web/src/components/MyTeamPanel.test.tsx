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
});
