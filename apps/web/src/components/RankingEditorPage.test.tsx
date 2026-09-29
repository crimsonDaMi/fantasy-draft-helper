import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("resyncs with the server after a cancelled drag", async () => {
    mockTwoTierRanking();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderWithClient(queryClient);
    const playerTwo = (await screen.findByText("Player Two")).closest("li")!;

    fireEvent.mouseDown(playerTwo, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(document, { clientX: 0, clientY: 20 });
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    mocks.getRanking.mockResolvedValue({
      players: [
        rankedPlayer(1, "S", "1", "Player One", "QB"),
        rankedPlayer(2, "A", "2", "Player Two", "RB"),
        rankedPlayer(3, "A", "3", "Player Three", "WR"),
      ],
      tiers: [
        { label: "S", position: 1, playerCount: 1 },
        { label: "A", position: 2, playerCount: 2 },
      ],
    });
    await queryClient.invalidateQueries();

    const tierA = screen.getByRole("heading", { name: "Tier A" }).parentElement!
      .parentElement!;
    await waitFor(() =>
      expect(within(tierA).getByText("Player Two")).toBeInTheDocument(),
    );
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

  describe("with the keyboard", () => {
    const row = (name: string) => screen.getByText(name).closest("li")!;

    beforeEach(() => {
      mockTwoTierRanking();
      mocks.moveRankingPlayer.mockResolvedValue({});
    });

    it("makes one row per container a tab stop", async () => {
      renderWithClient();
      await screen.findByText("Player One");

      expect(row("Player One")).toHaveAttribute("tabindex", "0");
      expect(row("Player Two")).toHaveAttribute("tabindex", "-1");
      expect(row("Player Three")).toHaveAttribute("tabindex", "0");
      expect(
        screen.getByRole("button", { name: "Watch Player Two" }),
      ).toHaveAttribute("tabindex", "-1");
    });

    it("moves focus between rows with the arrow keys", async () => {
      renderWithClient();
      await screen.findByText("Player One");
      row("Player One").focus();

      fireEvent.keyDown(row("Player One"), { key: "ArrowDown" });

      await waitFor(() => expect(row("Player Two")).toHaveFocus());
      expect(row("Player Two")).toHaveAttribute("tabindex", "0");
      expect(row("Player One")).toHaveAttribute("tabindex", "-1");
    });

    it("moves a player into the next tier with Alt+ArrowDown and keeps focus on it", async () => {
      renderWithClient();
      await screen.findByText("Player One");
      row("Player Two").focus();

      fireEvent.keyDown(row("Player Two"), { key: "ArrowDown", altKey: true });

      await waitFor(() =>
        expect(mocks.moveRankingPlayer).toHaveBeenCalledWith(
          "ranking-1",
          "2",
          2,
          "A",
        ),
      );
      await waitFor(() => expect(row("Player Two")).toHaveFocus());
      expect(
        screen.getByText("Player Two moved to Tier A, rank 2"),
      ).toBeInTheDocument();
    });

    it("scrolls a keyboard-moved player into view", async () => {
      const scrollIntoView = vi.spyOn(
        window.HTMLElement.prototype,
        "scrollIntoView",
      );
      renderWithClient();
      await screen.findByText("Player One");
      row("Player One").focus();

      fireEvent.keyDown(row("Player One"), { key: "ArrowDown", altKey: true });

      await waitFor(() =>
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" }),
      );
      expect(scrollIntoView.mock.contexts).toContain(row("Player One"));
      scrollIntoView.mockRestore();
    });

    it("keeps focus on a player that a server resync moves to another tier", async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      renderWithClient(queryClient);
      await screen.findByText("Player One");
      row("Player Two").focus();

      mocks.getRanking.mockResolvedValue({
        players: [
          rankedPlayer(1, "S", "1", "Player One", "QB"),
          rankedPlayer(2, "A", "2", "Player Two", "RB"),
          rankedPlayer(3, "A", "3", "Player Three", "WR"),
        ],
        tiers: [
          { label: "S", position: 1, playerCount: 2 },
          { label: "A", position: 2, playerCount: 1 },
        ],
      });
      await queryClient.invalidateQueries();

      const tierA = screen.getByRole("heading", { name: "Tier A" })
        .parentElement!.parentElement!;
      await waitFor(() =>
        expect(within(tierA).getByText("Player Two")).toBeInTheDocument(),
      );
      expect(row("Player Two")).toHaveFocus();
    });

    it("doesn't move the first player of the ranking up", async () => {
      renderWithClient();
      await screen.findByText("Player One");

      fireEvent.keyDown(row("Player One"), { key: "ArrowUp", altKey: true });

      expect(mocks.moveRankingPlayer).not.toHaveBeenCalled();
    });

    it("opens the move menu with Enter", async () => {
      renderWithClient();
      await screen.findByText("Player One");

      fireEvent.keyDown(row("Player Three"), { key: "Enter" });

      expect(
        screen.getByRole("dialog", { name: "Move Player Three" }),
      ).toBeInTheDocument();
    });

    it("leaves Enter on a watch button to the button", async () => {
      renderWithClient();
      await screen.findByText("Player One");

      fireEvent.keyDown(
        screen.getByRole("button", { name: "Watch Player One" }),
        { key: "Enter" },
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("on phones", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
          matches: query === "(max-width: 599px)",
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        })),
      );
      mockTwoTierRanking();
      mocks.getUnrankedPlayers.mockResolvedValue({
        players: [
          {
            sleeperId: "4",
            fullName: "Player Four",
            position: "TE",
            team: "MIA",
          },
        ],
      });
      mocks.moveRankingPlayer.mockResolvedValue({});
      mocks.removeRankingPlayer.mockResolvedValue({});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("switches between the tiers and the unranked panel", async () => {
      renderWithClient();
      await screen.findByText("Player One");

      expect(screen.queryByText("Player Four")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Unranked" }));

      expect(screen.getByText("Player Four")).toBeInTheDocument();
      expect(screen.queryByText("Player One")).not.toBeInTheDocument();
    });

    it("adds a tapped unranked player to the end of a tier", async () => {
      renderWithClient();
      await screen.findByText("Player One");
      fireEvent.click(screen.getByRole("button", { name: "Unranked" }));

      fireEvent.click(screen.getByText("Player Four"));
      const menu = screen.getByRole("dialog", { name: "Move Player Four" });
      expect(
        within(menu).queryByRole("button", { name: "Remove from ranking" }),
      ).not.toBeInTheDocument();
      fireEvent.click(within(menu).getByRole("button", { name: "Tier A" }));

      await waitFor(() =>
        expect(mocks.moveRankingPlayer).toHaveBeenCalledWith(
          "ranking-1",
          "4",
          4,
          "A",
        ),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("moves a tapped ranked player to the end of another tier", async () => {
      renderWithClient();
      fireEvent.click(await screen.findByText("Player One"));

      fireEvent.click(
        within(
          screen.getByRole("dialog", { name: "Move Player One" }),
        ).getByRole("button", { name: "Tier A" }),
      );

      await waitFor(() =>
        expect(mocks.moveRankingPlayer).toHaveBeenCalledWith(
          "ranking-1",
          "1",
          3,
          "A",
        ),
      );
    });

    it("removes a tapped ranked player from the ranking", async () => {
      renderWithClient();
      fireEvent.click(await screen.findByText("Player Two"));

      fireEvent.click(
        screen.getByRole("button", { name: "Remove from ranking" }),
      );

      await waitFor(() =>
        expect(mocks.removeRankingPlayer).toHaveBeenCalledWith(
          "ranking-1",
          "2",
        ),
      );
    });

    it("doesn't open the menu when tapping a watch/avoid button", async () => {
      renderWithClient();
      await screen.findByText("Player One");
      mocks.setPlayerFlag.mockResolvedValue({});

      fireEvent.click(screen.getByRole("button", { name: "Watch Player One" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
