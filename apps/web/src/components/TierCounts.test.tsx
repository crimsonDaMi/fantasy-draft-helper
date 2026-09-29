import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TierCounts } from "./TierCounts";

describe("TierCounts", () => {
  afterEach(cleanup);

  it("toggles its explanation with the info button", () => {
    render(
      <TierCounts
        counts={[{ position: "QB", tiers: [{ tier: "B", remaining: 2 }] }]}
      />,
    );

    const button = screen.getByRole("button", { name: "About tier counts" });
    expect(screen.queryByText(/two players from your tier B/)).toBeNull();

    fireEvent.click(button);
    const panel = screen.getByText(/two players from your tier B/);
    expect(button).toHaveAttribute("aria-controls", panel.id);

    fireEvent.click(button);
    expect(screen.queryByText(/two players from your tier B/)).toBeNull();
  });
});
