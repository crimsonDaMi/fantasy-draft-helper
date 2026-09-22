import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RankingEditorPage } from "./RankingEditorPage";

const mocks = vi.hoisted(() => ({
  getRankingsStatus: vi.fn(),
  getRanking: vi.fn(),
  getUnrankedPlayers: vi.fn(),
  moveRankingPlayer: vi.fn(),
  removeRankingPlayer: vi.fn(),
  insertTier: vi.fn(),
  removeTier: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  getRankingsStatus: mocks.getRankingsStatus,
  getRanking: mocks.getRanking,
  getUnrankedPlayers: mocks.getUnrankedPlayers,
  moveRankingPlayer: mocks.moveRankingPlayer,
  removeRankingPlayer: mocks.removeRankingPlayer,
  insertTier: mocks.insertTier,
  removeTier: mocks.removeTier,
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RankingEditorPage />
    </QueryClientProvider>,
  );
}

describe("RankingEditorPage", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("prompts to import a ranking when none exists", async () => {
    mocks.getRankingsStatus.mockResolvedValue({
      loaded: false,
      rankingCount: 0,
      matchedCount: 0,
    });

    renderWithClient();

    expect(
      await screen.findByText(/import a ranking on the draft tab first/i),
    ).toBeInTheDocument();
  });

  it("renders players grouped by tier and the unranked panel", async () => {
    mocks.getRankingsStatus.mockResolvedValue({
      loaded: true,
      rankingId: "ranking-1",
      rankingCount: 1,
      matchedCount: 1,
    });

    mocks.getRanking.mockResolvedValue({
      players: [
        {
          ranking: { rank: 1, playerName: "Player One", tier: "S" },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            position: "QB",
            team: "BUF",
          },
          method: "SLEEPER_ID",
        },
      ],
      tiers: [{ label: "S", position: 1, playerCount: 1 }],
    });

    mocks.getUnrankedPlayers.mockResolvedValue({
      players: [
        {
          sleeperId: "2",
          fullName: "Player Two",
          position: "RB",
          team: "MIA",
        },
      ],
    });

    renderWithClient();

    await waitFor(() =>
      expect(screen.getByText("Player One")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tier S")).toBeInTheDocument();
    expect(screen.getByText("Player Two")).toBeInTheDocument();
  });
});
