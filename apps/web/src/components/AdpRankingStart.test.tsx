import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { AdpRankingStart } from "./AdpRankingStart";

const mocks = vi.hoisted(() => ({
  createRankingFromAdp: vi.fn(),
}));

vi.mock("../api/fantasy-api", async (importOriginal) => ({
  ApiRequestError: (await importOriginal<typeof import("../api/fantasy-api")>())
    .ApiRequestError,
  createRankingFromAdp: mocks.createRankingFromAdp,
}));

function renderStart() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const onCreated = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <AdpRankingStart onCreated={onCreated} />
    </QueryClientProvider>,
  );

  return { onCreated, invalidateQueries };
}

describe("AdpRankingStart", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("creates a ranking in the chosen ADP format and selects it", async () => {
    mocks.createRankingFromAdp.mockResolvedValue({ rankingId: "ranking-7" });
    const { onCreated, invalidateQueries } = renderStart();

    fireEvent.change(screen.getByLabelText(/start from sleeper adp/i), {
      target: { value: "Dynasty SF ADP" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create ranking" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("ranking-7"));
    expect(mocks.createRankingFromAdp.mock.calls[0]?.[0]).toBe(
      "Dynasty SF ADP",
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.rankingList(),
    });
  });

  it("explains when the ADP data can't be reached", async () => {
    mocks.createRankingFromAdp.mockRejectedValue(
      new ApiRequestError(
        "Sleeper's ADP data can't be reached right now. Try again in a few minutes.",
        503,
      ),
    );
    const { onCreated } = renderStart();

    fireEvent.click(screen.getByRole("button", { name: "Create ranking" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't create the ranking: Sleeper's ADP data can't be reached right now. Try again in a few minutes.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
