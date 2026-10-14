import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RankingPrintPage } from "./RankingPrintPage";

const mocks = vi.hoisted(() => ({
  listRankings: vi.fn(),
  getRanking: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  listRankings: mocks.listRankings,
  getRanking: mocks.getRanking,
}));

function renderPrintPage() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <RankingPrintPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("RankingPrintPage", () => {
  it("lists the ranking by tier with flags, notes and bye weeks", async () => {
    mocks.listRankings.mockResolvedValue({
      rankings: [{ id: "r1", name: "Main league", playerCount: 2 }],
    });
    mocks.getRanking.mockResolvedValue({
      players: [
        {
          ranking: {
            rank: 1,
            playerName: "Player One",
            tier: "S",
            bye: 7,
            note: "target share up",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            position: "WR",
            team: "AAA",
          },
          method: "SLEEPER_ID",
        },
        {
          ranking: { rank: 2, playerName: "Player Two", tier: "A" },
          player: {
            sleeperId: "2",
            fullName: "Player Two",
            position: "RB",
            team: "BBB",
          },
          method: "SLEEPER_ID",
        },
      ],
      tiers: [
        { label: "S", position: 1, playerCount: 1 },
        { label: "A", position: 2, playerCount: 1 },
      ],
      flags: { "2": "avoid" },
    });

    renderPrintPage();

    expect(
      await screen.findByRole("heading", { name: "Main league" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tier S" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tier A" })).toBeTruthy();
    expect(screen.getByText("WR1 · AAA · Bye 7")).toBeTruthy();
    expect(screen.getByText("target share up")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Avoided" })).toBeTruthy();
    expect(screen.getByText(/^2 players/)).toBeTruthy();
  });

  it("numbers tiers when the editor shows numbers", async () => {
    window.localStorage.setItem("draft-helper-tier-display-mode", "numeric");
    mocks.listRankings.mockResolvedValue({
      rankings: [{ id: "r1", name: "Main league", playerCount: 1 }],
    });
    mocks.getRanking.mockResolvedValue({
      players: [
        {
          ranking: { rank: 1, playerName: "Player One", tier: "A" },
          player: { sleeperId: "1", fullName: "Player One", position: "WR" },
          method: "SLEEPER_ID",
        },
      ],
      tiers: [
        { label: "S", position: 1, playerCount: 0 },
        { label: "A", position: 2, playerCount: 1 },
      ],
      flags: {},
    });

    renderPrintPage();

    expect(await screen.findByRole("heading", { name: "Tier 2" })).toBeTruthy();
  });

  it("opens the browser's print dialog", async () => {
    mocks.listRankings.mockResolvedValue({
      rankings: [{ id: "r1", name: "Main league", playerCount: 0 }],
    });
    mocks.getRanking.mockResolvedValue({ players: [], tiers: [], flags: {} });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});

    renderPrintPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Print or save as PDF" }),
    );

    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it("points to the editor when there is no ranking yet", async () => {
    mocks.listRankings.mockResolvedValue({ rankings: [] });

    renderPrintPage();

    expect(
      (await screen.findByRole("link", { name: "Start one" })).getAttribute(
        "href",
      ),
    ).toBe("/rankings/edit");
  });
});
