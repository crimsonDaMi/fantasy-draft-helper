import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdpService } from "./adp.service.js";

const SAMPLE_CSV =
  "Date,Redraft PPR ADP,Redraft SF ADP,Dynasty SF ADP,Player Id\n" +
  "2026-09-03,1.2,1.5,3,9221\n" +
  "2026-09-03,2.2,2.6,,9509\n";

function createFakeAdpClient(csv: string | Error) {
  return {
    getAdpCsv: vi.fn(async () => {
      if (csv instanceof Error) {
        throw csv;
      }
      return csv;
    }),
  };
}

function createFakeLogger() {
  return { error: vi.fn() };
}

describe("AdpService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses each ADP column keyed by Sleeper player id", async () => {
    const adpClient = createFakeAdpClient(SAMPLE_CSV);
    const service = new AdpService(adpClient as never, createFakeLogger());

    const superflex = await service.getSnapshot("Redraft SF ADP");
    const ppr = await service.getSnapshot("Redraft PPR ADP");

    expect(superflex.get("9221")).toBe(1.5);
    expect(superflex.get("9509")).toBe(2.6);
    expect(ppr.get("9221")).toBe(1.2);
    expect(ppr.get("9509")).toBe(2.2);
    expect(adpClient.getAdpCsv).toHaveBeenCalledTimes(1);
  });

  it("skips blank cells rather than reading them as ADP 0", async () => {
    const adpClient = createFakeAdpClient(SAMPLE_CSV);
    const service = new AdpService(adpClient as never, createFakeLogger());

    const snapshot = await service.getSnapshot("Dynasty SF ADP");

    expect(snapshot.get("9221")).toBe(3);
    expect(snapshot.has("9509")).toBe(false);
  });

  it("returns an empty snapshot for a column missing from the sheet", async () => {
    const adpClient = createFakeAdpClient(SAMPLE_CSV);
    const service = new AdpService(adpClient as never, createFakeLogger());

    const snapshot = await service.getSnapshot("Redraft Half PPR ADP");

    expect(snapshot.size).toBe(0);
  });

  it("does not refetch within the refresh interval", async () => {
    const adpClient = createFakeAdpClient(SAMPLE_CSV);
    const service = new AdpService(adpClient as never, createFakeLogger());

    await service.getSnapshot("Redraft SF ADP");
    await service.getSnapshot("Redraft SF ADP");

    expect(adpClient.getAdpCsv).toHaveBeenCalledTimes(1);
  });

  it("serves the last-known snapshot when a refresh fails", async () => {
    const adpClient = createFakeAdpClient(SAMPLE_CSV);
    const logger = createFakeLogger();
    const service = new AdpService(adpClient as never, logger);

    await service.getSnapshot("Redraft SF ADP");

    vi.advanceTimersByTime(25 * 60 * 60 * 1000);

    adpClient.getAdpCsv.mockRejectedValueOnce(new Error("network error"));

    const snapshot = await service.getSnapshot("Redraft SF ADP");

    expect(snapshot.get("9221")).toBe(1.5);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("returns an empty snapshot rather than throwing on first-ever failure", async () => {
    const adpClient = createFakeAdpClient(new Error("network error"));
    const logger = createFakeLogger();
    const service = new AdpService(adpClient as never, logger);

    const snapshot = await service.getSnapshot("Redraft SF ADP");

    expect(snapshot.size).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      expect.stringContaining("Failed to refresh ADP data"),
    );
  });
});
