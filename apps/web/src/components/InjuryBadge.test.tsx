import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InjuryBadge } from "./InjuryBadge";

describe("InjuryBadge", () => {
  afterEach(cleanup);

  it("renders nothing for a healthy player", () => {
    const { container } = render(<InjuryBadge />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shortens known statuses and softens questionable", () => {
    render(
      <>
        <InjuryBadge status="Questionable" />
        <InjuryBadge status="Out" />
      </>,
    );

    expect(screen.getByText("Q")).toHaveClass("injury-badge--minor");
    expect(screen.getByText("O")).toHaveClass("injury-badge--major");
    expect(screen.getByText("O")).toHaveAttribute("title", "Out");
  });

  it("falls back to the first letters of an unknown status", () => {
    render(<InjuryBadge status="Suspended" />);

    expect(screen.getByText("SUS")).toBeInTheDocument();
  });
});
