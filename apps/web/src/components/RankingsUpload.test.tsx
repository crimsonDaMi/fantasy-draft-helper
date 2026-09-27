import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../api/query-keys";
import type { RankingImportResponse } from "../types/api";
import { RankingsUpload } from "./RankingsUpload";

const mocks = vi.hoisted(() => ({
  importRankings: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  importRankings: mocks.importRankings,
}));

const SUMMARY = {
  imported: 2,
  matched: 2,
  unmatched: 0,
  ambiguous: 0,
  errors: 0,
};

function importResponse(
  overrides: Partial<RankingImportResponse> = {},
): RankingImportResponse {
  return {
    rankingId: "ranking-1",
    summary: SUMMARY,
    validationErrors: [],
    unmatchedPlayers: [],
    ambiguousPlayers: [],
    ...overrides,
  };
}

function renderUpload() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
  const onImported = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <RankingsUpload onImported={onImported} />
    </QueryClientProvider>,
  );

  return { onImported, invalidateQueries };
}

function chooseFile() {
  const file = new File(["rank,player\n1,Test Player\n"], "rankings.csv", {
    type: "text/csv",
  });

  fireEvent.change(screen.getByLabelText("Choose CSV"), {
    target: { files: [file] },
  });

  return file;
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
}

describe("RankingsUpload", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks for a file when submitted without one", async () => {
    renderUpload();

    submit();

    expect(
      await screen.findByText("Please select a CSV file."),
    ).toBeInTheDocument();
    expect(mocks.importRankings).not.toHaveBeenCalled();
  });

  it("reports a successful import and refreshes the ranking status", async () => {
    mocks.importRankings.mockResolvedValue(importResponse());
    const { onImported, invalidateQueries } = renderUpload();

    const file = chooseFile();
    submit();

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith(SUMMARY, "ranking-1"),
    );
    expect(mocks.importRankings).toHaveBeenCalledWith(file);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.rankingStatus(),
    });
    expect(screen.queryByText(/Import completed with CSV errors/)).toBeNull();
  });

  it("lists row-level validation errors from a partial import", async () => {
    mocks.importRankings.mockResolvedValue(
      importResponse({
        validationErrors: [{ row: 3, message: "Rank must be a number" }],
      }),
    );
    const { onImported } = renderUpload();

    chooseFile();
    submit();

    expect(
      await screen.findByText("Row 3: Rank must be a number"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Import completed with CSV errors. Correct the listed rows and re-import the file.",
      ),
    ).toBeInTheDocument();
    expect(onImported).toHaveBeenCalled();
  });

  it("shows the error when the import fails", async () => {
    mocks.importRankings.mockRejectedValue(new Error("Missing rank column."));
    const { onImported } = renderUpload();

    chooseFile();
    submit();

    expect(
      await screen.findByText(
        "Missing rank column. Check the CSV headers and row values, then choose the corrected file and try again.",
      ),
    ).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
  });

  it("disables the button while the import is in flight", async () => {
    let resolveImport: (response: RankingImportResponse) => void = () => {};
    mocks.importRankings.mockReturnValue(
      new Promise<RankingImportResponse>((resolve) => {
        resolveImport = resolve;
      }),
    );
    renderUpload();

    chooseFile();
    submit();

    const button = await screen.findByRole("button", { name: "Importing…" });
    expect(button).toBeDisabled();

    resolveImport(importResponse());

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import" })).toBeEnabled(),
    );
  });
});
