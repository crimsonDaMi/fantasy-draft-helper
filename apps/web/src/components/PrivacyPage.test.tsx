import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivacyPage } from "./PrivacyPage";
import type { InstanceInfo } from "../api/fantasy-api";

const mocks = vi.hoisted(() => ({ getInstanceInfo: vi.fn() }));

vi.mock("../api/fantasy-api", () => ({
  getInstanceInfo: mocks.getInstanceInfo,
}));

function renderPrivacyPage(info: InstanceInfo) {
  mocks.getInstanceInfo.mockResolvedValue(info);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PrivacyPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("names the configured operator with a mail link and address", async () => {
    renderPrivacyPage({
      operator: {
        name: "Test Operator",
        contact: "privacy@example.com",
        address: "1 Example Street, 12345 Example City",
      },
      accountRetentionDays: 730,
    });

    expect(await screen.findByText("Test Operator")).toBeInTheDocument();
    expect(
      screen.getByText(/1 Example Street, 12345 Example City/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "privacy@example.com" }),
    ).toHaveAttribute("href", "mailto:privacy@example.com");
  });

  it("says so when no operator is configured, instead of a placeholder", async () => {
    renderPrivacyPage({ accountRetentionDays: 730 });

    expect(
      await screen.findByText(/hasn't provided their details/),
    ).toBeInTheDocument();
  });

  it("states the retention period", async () => {
    renderPrivacyPage({ accountRetentionDays: 730 });

    expect(
      await screen.findByText(/hasn't been used for 730 days \(2 years\)/),
    ).toBeInTheDocument();
  });

  it("says accounts are kept until deleted when retention is off", async () => {
    renderPrivacyPage({ accountRetentionDays: 0 });

    expect(
      await screen.findByText(/kept until you delete your account yourself/),
    ).toBeInTheDocument();
  });
});
