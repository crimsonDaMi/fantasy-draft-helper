import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftDashboard } from "./DraftDashboard";

const mocks = vi.hoisted(() => ({
  getRankingsStatus: vi.fn(),
  getRecommendations: vi.fn(),
  importRankings: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  ApiRequestError: class extends Error {},
  getRankingsStatus: mocks.getRankingsStatus,
  getRecommendations: mocks.getRecommendations,
  importRankings: mocks.importRankings,
}));

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DraftDashboard />
    </QueryClientProvider>,
  );
}

describe("DraftDashboard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("collapses draft setup after starting a draft with a saved ranking", async () => {
    mocks.getRankingsStatus.mockResolvedValue({
      loaded: true,
      rankingId: "ranking-1",
      rankingCount: 2,
      matchedCount: 2,
    });
    mocks.getRecommendations.mockResolvedValue({
      draftId: "draft-1",
      draftStatus: "PRE_DRAFT",
      totalPicks: 0,
      draftedPlayerCount: 0,
      lastUpdatedAt: "2026-01-01T00:00:00.000Z",
      generatedAt: "2026-01-01T00:00:00.000Z",
      recommendationCount: 0,
      recommendations: [],
    });

    const { container } = renderWithClient();
    const setup = container.querySelector("details.draft-setup");

    expect(setup).toHaveAttribute("open");
    await screen.findByText(/using your saved ranking/i);

    fireEvent.change(screen.getByPlaceholderText("Sleeper draft ID"), {
      target: { value: "draft-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => expect(setup).not.toHaveAttribute("open"));
  });

  it("keeps draft setup open when no ranking is available yet", async () => {
    mocks.getRankingsStatus.mockResolvedValue({
      loaded: false,
      rankingCount: 0,
      matchedCount: 0,
    });

    const { container } = renderWithClient();
    await waitFor(() => expect(mocks.getRankingsStatus).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Sleeper draft ID"), {
      target: { value: "draft-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(container.querySelector("details.draft-setup")).toHaveAttribute(
      "open",
    );
  });
});
