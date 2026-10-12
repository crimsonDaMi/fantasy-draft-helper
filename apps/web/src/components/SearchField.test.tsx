import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SearchField } from "./SearchField";

function ControlledSearch() {
  const [value, setValue] = useState("");

  return (
    <SearchField
      value={value}
      onValueChange={setValue}
      aria-label="Search players"
    />
  );
}

describe("SearchField", () => {
  afterEach(cleanup);

  it("shows its clear button only with text, and clearing keeps focus", () => {
    render(<ControlledSearch />);

    const input = screen.getByRole("searchbox", { name: "Search players" });
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();

    fireEvent.change(input, { target: { value: "Player" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });
});
