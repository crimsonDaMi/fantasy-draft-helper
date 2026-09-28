import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
  createEmptyRanking: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  getRankingsStatus: mocks.getRankingsStatus,
  getRanking: mocks.getRanking,
  getUnrankedPlayers: mocks.getUnrankedPlayers,
  moveRankingPlayer: mocks.moveRankingPlayer,
  removeRankingPlayer: mocks.removeRankingPlayer,
  insertTier: mocks.insertTier,
  removeTier: mocks.removeTier,
  createEmptyRanking: mocks.createEmptyRanking,
  RANKINGS_EXPORT_URL: "http://api.test/rankings/export",
}));

function renderWithClient(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <RankingEditorPage />
    </QueryClientProvider>,
  );
}

function rankedPlayer(
  rank: number,
  tier: string,
  sleeperId: string,
  fullName: string,
  position: string,
) {
  return {
    ranking: { rank, playerName: fullName, tier },
    player: { sleeperId, fullName, position, team: "BUF" },
    method: "SLEEPER_ID",
  };
}

function mockTwoTierRanking() {
  mocks.getRankingsStatus.mockResolvedValue({
    loaded: true,
    rankingId: "ranking-1",
    rankingCount: 3,
    matchedCount: 3,
  });

  mocks.getRanking.mockResolvedValue({
    players: [
      rankedPlayer(1, "S", "1", "Player One", "QB"),
      rankedPlayer(2, "S", "2", "Player Two", "RB"),
      rankedPlayer(3, "A", "3", "Player Three", "WR"),
    ],
    tiers: [
      { label: "S", position: 1, playerCount: 2 },
      { label: "A", position: 2, playerCount: 1 },
    ],
  });

  mocks.getUnrankedPlayers.mockResolvedValue({ players: [] });
}

function requestTierRemoval(tierIndex: number) {
  fireEvent.click(
    screen.getAllByRole("button", { name: "Remove tier" })[tierIndex],
  );
}

describe("RankingEditorPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers to import or start a new ranking when none exists", async () => {
    mocks.getRankingsStatus.mockResolvedValue({
      loaded: false,
      rankingCount: 0,
      matchedCount: 0,
    });

    renderWithClient();

    expect(
      await screen.findByText(/import a ranking on the draft tab/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /start a new ranking/i }),
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
    // Names are truncated with an ellipsis in fixed-height rows; the full
    // name stays available as a tooltip.
    expect(screen.getByText("Player Two")).toHaveAttribute(
      "title",
      "Player Two",
    );
  });

  it("links to the CSV export of the current ranking", async () => {
    mockTwoTierRanking();
    renderWithClient();

    const link = await screen.findByRole("link", { name: "Export CSV" });

    expect(link).toHaveAttribute("href", "http://api.test/rankings/export");
    expect(link).toHaveAttribute("download");
  });

  it("asks to merge a tier's players into the next tier", async () => {
    mockTwoTierRanking();
    renderWithClient();
    await screen.findByText("Player Three");

    requestTierRemoval(0);

    expect(
      screen.getByText("Merge 2 player(s) into the next tier?"),
    ).toBeInTheDocument();
  });

  it("asks to merge the last tier's players into the tier above", async () => {
    mockTwoTierRanking();
    renderWithClient();
    await screen.findByText("Player Three");

    requestTierRemoval(1);

    expect(
      screen.getByText("Merge 1 player(s) into the tier above?"),
    ).toBeInTheDocument();
  });

  it("counts every player in the tier even when a position filter hides some", async () => {
    mockTwoTierRanking();
    renderWithClient();

    await screen.findByText("Player Two");
    fireEvent.click(screen.getByLabelText("QB"));
    await waitFor(() => expect(screen.queryByText("Player Two")).toBeNull());

    requestTierRemoval(0);

    expect(
      screen.getByText("Merge 2 player(s) into the next tier?"),
    ).toBeInTheDocument();
  });

  it("shows the ranking again when returning to the editor", async () => {
    mockTwoTierRanking();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const firstVisit = renderWithClient(queryClient);
    await screen.findByText("Player One");
    firstVisit.unmount();

    // Same cache, as after switching to the Draft tab and back.
    renderWithClient(queryClient);

    expect(await screen.findByText("Player One")).toBeInTheDocument();
  });
});
