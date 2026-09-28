import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PositionBadge } from "./PositionBadge";

describe("PositionBadge", () => {
  afterEach(cleanup);

  it("uses the position's color variant", () => {
    const { container } = render(<PositionBadge position="QB" />);

    expect(container.firstChild).toHaveClass("position-badge--qb");
    expect(container.firstChild).toHaveTextContent("QB");
  });

  it("falls back to the neutral variant for other positions", () => {
    const { container } = render(<PositionBadge position="LB" />);

    expect(container.firstChild).toHaveClass("position-badge--other");
    expect(container.firstChild).toHaveTextContent("LB");
  });

  it("renders an empty placeholder when the position is missing", () => {
    const { container } = render(<PositionBadge />);

    expect(container.firstChild).toHaveClass("position-badge--other");
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
