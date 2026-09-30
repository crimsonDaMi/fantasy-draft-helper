import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftDashboard } from "./DraftDashboard";
import type { RecommendationsResponse } from "../types/api";

const mocks = vi.hoisted(() => ({
  listRankings: vi.fn(),
  renameRanking: vi.fn(),
  deleteRanking: vi.fn(),
  setPlayerFlag: vi.fn(),
  getRecommendations: vi.fn(),
  importRankings: vi.fn(),
  findUserDrafts: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  ApiRequestError: class extends Error {},
  listRankings: mocks.listRankings,
  renameRanking: mocks.renameRanking,
  deleteRanking: mocks.deleteRanking,
  setPlayerFlag: mocks.setPlayerFlag,
  getRecommendations: mocks.getRecommendations,
  importRankings: mocks.importRankings,
  findUserDrafts: mocks.findUserDrafts,
}));

function recommendationsResponse(
  overrides: Partial<RecommendationsResponse> = {},
): RecommendationsResponse {
  return {
    draftId: "draft-1",
    draftStatus: "PRE_DRAFT",
    totalPicks: 0,
    draftedPlayerCount: 0,
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
    generatedAt: "2026-01-01T00:00:00.000Z",
    recommendationCount: 0,
    recommendations: [],
    draft: { type: "snake", teams: 4, rounds: 3, rosterSlots: { QB: 1 } },
    adpFormat: "1QB PPR",
    picks: [],
    tierCounts: [],
    avoidedCount: 0,
    ...overrides,
  };
}

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DraftDashboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("DraftDashboard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("collapses draft setup after starting a draft with a saved ranking", async () => {
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.getRecommendations.mockResolvedValue(recommendationsResponse());

    const { container } = renderWithClient();
    const setup = container.querySelector("details.draft-setup");

    expect(setup).toHaveAttribute("open");
    await screen.findByText(/using your saved ranking/i);

    fireEvent.change(screen.getByPlaceholderText("Sleeper draft link or ID"), {
      target: { value: "draft-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => expect(setup).not.toHaveAttribute("open"));
  });

  it("keeps draft setup open when no ranking is available yet", async () => {
    mocks.listRankings.mockResolvedValue({ rankings: [] });

    const { container } = renderWithClient();
    await waitFor(() => expect(mocks.listRankings).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Sleeper draft link or ID"), {
      target: { value: "draft-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(container.querySelector("details.draft-setup")).toHaveAttribute(
      "open",
    );
  });

  it("resumes a draft stored by an earlier page load", async () => {
    window.localStorage.setItem(
      "draft-helper-draft",
      JSON.stringify({ draftId: "draft-1" }),
    );
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.getRecommendations.mockResolvedValue(recommendationsResponse());

    const { container } = renderWithClient();

    expect(container.querySelector("details.draft-setup")).not.toHaveAttribute(
      "open",
    );
    await waitFor(() =>
      expect(mocks.getRecommendations).toHaveBeenCalledWith(
        "draft-1",
        "ranking-1",
        expect.anything(),
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop monitoring" }));

    expect(window.localStorage.getItem("draft-helper-draft")).toBeNull();
    expect(
      await screen.findByText(/enter a draft ID to begin monitoring/i),
    ).toBeInTheDocument();
  });

  it("moves tier counts beside My team on wide screens", async () => {
    window.localStorage.setItem(
      "draft-helper-draft",
      JSON.stringify({ draftId: "draft-1" }),
    );
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.getRecommendations.mockResolvedValue(
      recommendationsResponse({
        tierCounts: [{ position: "QB", tiers: [{ tier: "A", remaining: 2 }] }],
      }),
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(min-width: 1200px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );

    try {
      const { container } = renderWithClient();
      const tierCounts = await screen.findByText(/left in your top tiers/i);

      expect(
        container.querySelector(".draft-board__side")?.contains(tierCounts),
      ).toBe(true);
      expect(
        container.querySelector(".draft-board__main")?.contains(tierCounts),
      ).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stores the draft when monitoring starts", async () => {
    mocks.listRankings.mockResolvedValue({ rankings: [] });

    renderWithClient();

    fireEvent.change(screen.getByPlaceholderText("Sleeper draft link or ID"), {
      target: { value: " draft-2 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(
      JSON.parse(window.localStorage.getItem("draft-helper-draft") ?? "null"),
    ).toEqual({ draftId: "draft-2" });
  });

  it("finds drafts by Sleeper username and follows the user's slot", async () => {
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.findUserDrafts.mockResolvedValue({
      sleeperUserId: "sleeper-user-1",
      drafts: [
        {
          draftId: "draft-1",
          name: "Test League",
          status: "DRAFTING",
          type: "snake",
          teams: 4,
          season: "2026",
        },
      ],
    });
    mocks.getRecommendations.mockResolvedValue(
      recommendationsResponse({
        draftStatus: "DRAFTING",
        draft: {
          type: "snake",
          teams: 4,
          rounds: 3,
          draftOrder: { "sleeper-user-1": 2 },
          rosterSlots: { QB: 1, RB: 1 },
        },
        picks: [
          {
            pickNo: 1,
            draftSlot: 1,
            pickedBy: "other-user",
            playerId: "10",
            playerName: "Player Ten",
            position: "RB",
            rank: 14,
          },
          {
            pickNo: 2,
            draftSlot: 2,
            pickedBy: "sleeper-user-1",
            playerId: "11",
            playerName: "Player Eleven",
            position: "QB",
            rank: 2,
          },
        ],
      }),
    );

    renderWithClient();

    fireEvent.change(screen.getByLabelText("Sleeper username"), {
      target: { value: "testuser" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find drafts" }));
    fireEvent.click(await screen.findByRole("button", { name: "Monitor" }));

    expect(mocks.findUserDrafts).toHaveBeenCalledWith(
      "testuser",
      String(new Date().getFullYear()),
    );
    expect(
      JSON.parse(window.localStorage.getItem("draft-helper-draft") ?? "null"),
    ).toEqual({ draftId: "draft-1", sleeperUserId: "sleeper-user-1" });

    // Slot 2 of 4 picks 2nd and 7th; pick 3 is on the clock.
    expect(await screen.findByText("You pick in 4 (2.03)")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "My team" })).getByText(
        "Player Eleven",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("reach")).toHaveClass("adp-diff--reach");
  });

  it("shows the draft recap once the draft is complete", async () => {
    window.localStorage.setItem(
      "draft-helper-draft",
      JSON.stringify({ draftId: "draft-1", draftSlot: 1 }),
    );
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.getRecommendations.mockResolvedValue(
      recommendationsResponse({
        draftStatus: "COMPLETE",
        picks: [
          {
            pickNo: 1,
            draftSlot: 1,
            playerId: "10",
            playerName: "Player Ten",
            position: "QB",
            rank: 3,
            adp: 1.5,
          },
        ],
      }),
    );

    renderWithClient();

    expect(
      await screen.findByRole("heading", { name: "Draft recap" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
    expect(screen.getByText("-2")).toHaveClass("adp-diff--reach");
    expect(
      screen.getByRole("columnheader", { name: "ADP (1QB PPR)" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Search available players")).toBeNull();
  });

  it("flags players and can show the hidden ones", async () => {
    window.localStorage.setItem(
      "draft-helper-draft",
      JSON.stringify({ draftId: "draft-1" }),
    );
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 2,
          matchedCount: 2,
        },
      ],
    });
    mocks.setPlayerFlag.mockResolvedValue({ flags: {} });
    mocks.getRecommendations.mockResolvedValue(
      recommendationsResponse({
        draftStatus: "DRAFTING",
        avoidedCount: 1,
        recommendations: [
          {
            rank: 1,
            player: { sleeperId: "1", fullName: "Player One" },
            flag: "watch",
          },
        ],
      }),
    );

    renderWithClient();

    fireEvent.click(
      await screen.findByRole("button", { name: "Avoid Player One" }),
    );
    await waitFor(() =>
      expect(mocks.setPlayerFlag).toHaveBeenCalledWith(
        "ranking-1",
        "1",
        "avoid",
      ),
    );
    expect(
      screen.getByRole("button", { name: "Watch Player One" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByLabelText("Show hidden players (1)"));

    await waitFor(() =>
      expect(mocks.getRecommendations).toHaveBeenLastCalledWith(
        "draft-1",
        "ranking-1",
        expect.objectContaining({ showAvoided: true }),
      ),
    );
  });

  it("monitors a draft from a pasted Sleeper draft link", async () => {
    mocks.listRankings.mockResolvedValue({ rankings: [] });

    renderWithClient();

    const input = screen.getByPlaceholderText("Sleeper draft link or ID");
    fireEvent.change(input, {
      target: { value: "https://sleeper.com/draft/nfl/1234567890" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(input).toHaveValue("1234567890");
    expect(
      JSON.parse(window.localStorage.getItem("draft-helper-draft") ?? "null"),
    ).toEqual({ draftId: "1234567890" });
  });
});
