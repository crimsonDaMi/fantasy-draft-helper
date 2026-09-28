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
  listRankings: vi.fn(),
  renameRanking: vi.fn(),
  deleteRanking: vi.fn(),
  setPlayerFlag: vi.fn(),
  getRanking: vi.fn(),
  getUnrankedPlayers: vi.fn(),
  moveRankingPlayer: vi.fn(),
  removeRankingPlayer: vi.fn(),
  insertTier: vi.fn(),
  removeTier: vi.fn(),
  createEmptyRanking: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  listRankings: mocks.listRankings,
  renameRanking: mocks.renameRanking,
  deleteRanking: mocks.deleteRanking,
  setPlayerFlag: mocks.setPlayerFlag,
  getRanking: mocks.getRanking,
  getUnrankedPlayers: mocks.getUnrankedPlayers,
  moveRankingPlayer: mocks.moveRankingPlayer,
  removeRankingPlayer: mocks.removeRankingPlayer,
  insertTier: mocks.insertTier,
  removeTier: mocks.removeTier,
  createEmptyRanking: mocks.createEmptyRanking,
  rankingExportUrl: (rankingId: string) =>
    `http://api.test/rankings/export?rankingId=${rankingId}`,
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
  mocks.listRankings.mockResolvedValue({
    rankings: [
      {
        id: "ranking-1",
        name: "Test ranking",
        createdAt: "2026-01-01T00:00:00.000Z",
        playerCount: 3,
        matchedCount: 3,
      },
    ],
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
    window.localStorage.clear();
  });

  it("offers to import or start a new ranking when none exists", async () => {
    mocks.listRankings.mockResolvedValue({ rankings: [] });

    renderWithClient();

    expect(
      await screen.findByText(/import a ranking on the draft tab/i),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /start a new ranking/i }),
    ).toBeInTheDocument();
  });

  it("renders players grouped by tier and the unranked panel", async () => {
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "Test ranking",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 1,
          matchedCount: 1,
        },
      ],
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

    expect(link).toHaveAttribute(
      "href",
      "http://api.test/rankings/export?rankingId=ranking-1",
    );
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

  it("watches a ranked player from its row", async () => {
    mockTwoTierRanking();
    mocks.setPlayerFlag.mockResolvedValue({ flags: { "1": "watch" } });
    renderWithClient();
    await screen.findByText("Player One");

    // The server's refetched detail includes the new flag.
    const detail = await mocks.getRanking();
    mocks.getRanking.mockResolvedValue({ ...detail, flags: { "1": "watch" } });

    fireEvent.click(screen.getByRole("button", { name: "Watch Player One" }));

    await waitFor(() =>
      expect(mocks.setPlayerFlag).toHaveBeenCalledWith(
        "ranking-1",
        "1",
        "watch",
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Watch Player One" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
  });

  it("edits the ranking remembered from an earlier visit", async () => {
    window.localStorage.setItem("draft-helper-ranking", "ranking-2");
    mockTwoTierRanking();
    mocks.listRankings.mockResolvedValue({
      rankings: [
        {
          id: "ranking-1",
          name: "League A",
          createdAt: "2026-01-02T00:00:00.000Z",
          playerCount: 3,
          matchedCount: 3,
        },
        {
          id: "ranking-2",
          name: "League B",
          createdAt: "2026-01-01T00:00:00.000Z",
          playerCount: 3,
          matchedCount: 3,
        },
      ],
    });

    renderWithClient();

    await waitFor(() =>
      expect(mocks.getRanking).toHaveBeenCalledWith("ranking-2"),
    );
    expect(
      await screen.findByRole("combobox", { name: "Ranking" }),
    ).toHaveValue("ranking-2");
  });

  it("switches to a newly started ranking", async () => {
    mockTwoTierRanking();
    mocks.createEmptyRanking.mockResolvedValue({ rankingId: "ranking-new" });
    renderWithClient();
    await screen.findByText("Player One");

    fireEvent.click(screen.getByRole("button", { name: "+ New ranking" }));

    await waitFor(() =>
      expect(window.localStorage.getItem("draft-helper-ranking")).toBe(
        "ranking-new",
      ),
    );
    expect(mocks.listRankings).toHaveBeenCalledTimes(2);
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
