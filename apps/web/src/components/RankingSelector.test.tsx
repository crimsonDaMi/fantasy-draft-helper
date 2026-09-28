import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RankingSelector } from "./RankingSelector";
import type { RankingSummary } from "../types/api";

const mocks = vi.hoisted(() => ({
  renameRanking: vi.fn(),
  deleteRanking: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  renameRanking: mocks.renameRanking,
  deleteRanking: mocks.deleteRanking,
}));

function ranking(id: string, name: string): RankingSummary {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    playerCount: 10,
    matchedCount: 9,
  };
}

const RANKINGS = [
  ranking("ranking-1", "League A"),
  ranking("ranking-2", "League B"),
];

function renderSelector(onSelect = vi.fn()) {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <RankingSelector
        rankings={RANKINGS}
        selectedRanking={RANKINGS[0]!}
        onSelect={onSelect}
      />
    </QueryClientProvider>,
  );

  return onSelect;
}

describe("RankingSelector", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("selects another ranking", () => {
    const onSelect = renderSelector();

    fireEvent.change(screen.getByRole("combobox", { name: "Ranking" }), {
      target: { value: "ranking-2" },
    });

    expect(onSelect).toHaveBeenCalledWith("ranking-2");
  });

  it("renames the selected ranking", async () => {
    mocks.renameRanking.mockResolvedValue({});
    renderSelector();

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Ranking name" }), {
      target: { value: " Main league " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.renameRanking).toHaveBeenCalledWith(
        "ranking-1",
        "Main league",
      ),
    );
  });

  it("deletes after confirmation and moves to another ranking", async () => {
    mocks.deleteRanking.mockResolvedValue(undefined);
    const onSelect = renderSelector();

    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    expect(mocks.deleteRanking).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith("ranking-2"));
    expect(mocks.deleteRanking).toHaveBeenCalledWith("ranking-1");
  });
});
