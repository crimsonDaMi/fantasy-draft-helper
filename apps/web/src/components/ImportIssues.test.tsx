import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { ImportIssues } from "./ImportIssues";

function renderIssues(props: Parameters<typeof ImportIssues>[0]) {
  return render(
    <MemoryRouter>
      <ImportIssues {...props} />
    </MemoryRouter>,
  );
}

describe("ImportIssues", () => {
  afterEach(cleanup);

  it("lists unmatched and ambiguous rows in rank order with a link to the editor", () => {
    renderIssues({
      unmatchedPlayers: [
        { rank: 12, name: "Test Nobody", position: "WR", team: "BUF" },
      ],
      ambiguousPlayers: [
        {
          rank: 3,
          name: "Test Twin",
          candidates: [
            { sleeperId: "1", fullName: "Test Twin" },
            { sleeperId: "2", fullName: "Test Twin" },
          ],
        },
      ],
    });

    expect(screen.getByRole("heading")).toHaveTextContent(
      "2 players not matched",
    );
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "#3 Test Twin — 2 possible players",
      "#12 Test Nobody (WR, BUF) — no match",
    ]);
    expect(
      screen.getByRole("link", { name: "fix them in the ranking editor" }),
    ).toHaveAttribute("href", "/rankings/edit");
  });

  it("renders nothing when every row matched", () => {
    const { container } = renderIssues({
      unmatchedPlayers: [],
      ambiguousPlayers: [],
    });

    expect(container).toBeEmptyDOMElement();
  });
});
