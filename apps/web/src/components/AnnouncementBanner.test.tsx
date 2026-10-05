import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnnouncementBanner } from "./AnnouncementBanner";

const mocks = vi.hoisted(() => ({ getAnnouncement: vi.fn() }));

vi.mock("../api/fantasy-api", () => ({
  getAnnouncement: mocks.getAnnouncement,
}));

function renderBanner(message: string | null) {
  mocks.getAnnouncement.mockResolvedValue({ message });
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AnnouncementBanner />
    </QueryClientProvider>,
  );
}

describe("AnnouncementBanner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows the operator's message", async () => {
    renderBanner("Maintenance Sunday 03:00 UTC");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Maintenance Sunday 03:00 UTC",
    );
  });

  it("renders nothing without a message", async () => {
    const { container } = renderBanner(null);

    await vi.waitFor(() => expect(mocks.getAnnouncement).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the request fails", async () => {
    mocks.getAnnouncement.mockRejectedValue(new Error("offline"));
    const { container } = render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <AnnouncementBanner />
      </QueryClientProvider>,
    );

    await vi.waitFor(() => expect(mocks.getAnnouncement).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("stays dismissed for the same message, but shows a new one", async () => {
    renderBanner("Maintenance Sunday 03:00 UTC");

    fireEvent.click(
      await screen.findByRole("button", { name: "Dismiss announcement" }),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    cleanup();
    renderBanner("Maintenance Sunday 03:00 UTC");
    await vi.waitFor(() => expect(mocks.getAnnouncement).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    cleanup();
    renderBanner("Maintenance moved to Monday 03:00 UTC");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Maintenance moved to Monday 03:00 UTC",
    );
  });
});
