import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MonitoringStatus } from "./MonitoringStatus";

describe("MonitoringStatus", () => {
  afterEach(cleanup);

  it("shows when injury statuses were last updated", () => {
    const playersUpdatedAt = "2026-09-30T09:14:00.000Z";

    render(
      <MonitoringStatus
        draftId="draft-1"
        rankingId="ranking-1"
        draftStatus="DRAFTING"
        playersUpdatedAt={playersUpdatedAt}
        isLoading={false}
        onRetry={() => {}}
      />,
    );

    const expected = new Date(playersUpdatedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    expect(screen.getByText(`Injuries as of ${expected}`)).toBeInTheDocument();
  });

  it("omits the injury time when the player data isn't loaded", () => {
    render(
      <MonitoringStatus
        draftId="draft-1"
        rankingId="ranking-1"
        draftStatus="DRAFTING"
        isLoading={false}
        onRetry={() => {}}
      />,
    );

    expect(screen.queryByText(/Injuries as of/)).toBeNull();
  });
});
