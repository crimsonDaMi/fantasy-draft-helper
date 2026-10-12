import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DraftForm } from "./DraftForm";

vi.mock("../api/fantasy-api", () => ({ findUserDrafts: vi.fn() }));

function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DraftForm onSubmit={vi.fn()} />
    </QueryClientProvider>,
  );

  return screen.getByRole("spinbutton", { name: "Season" });
}

describe("DraftForm season stepper", () => {
  afterEach(cleanup);

  it("steps the season with its own buttons", () => {
    const season = renderForm();
    const year = new Date().getFullYear();

    fireEvent.click(screen.getByRole("button", { name: "Next season" }));
    expect(season).toHaveValue(year + 1);

    fireEvent.click(screen.getByRole("button", { name: "Previous season" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous season" }));
    expect(season).toHaveValue(year - 1);
  });

  it("stays within the allowed seasons", () => {
    const season = renderForm();

    fireEvent.change(season, { target: { value: "2017" } });
    expect(
      screen.getByRole("button", { name: "Previous season" }),
    ).toBeDisabled();

    fireEvent.change(season, { target: { value: "2100" } });
    expect(screen.getByRole("button", { name: "Next season" })).toBeDisabled();
  });

  it("steps from the current year when the field is empty", () => {
    const season = renderForm();

    fireEvent.change(season, { target: { value: "" } });
    expect(
      screen.getByRole("button", { name: "Previous season" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Next season" }));

    expect(season).toHaveValue(new Date().getFullYear() + 1);
  });
});
