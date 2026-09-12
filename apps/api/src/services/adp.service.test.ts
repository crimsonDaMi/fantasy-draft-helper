import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AdpService } from "./adp.service.js";

const SAMPLE_CSV =
  "Date,Redraft PPR ADP,Redraft SF ADP,Player Id\n" +
  "2026-09-03,1.2,1.5,9221\n" +
  "2026-09-03,2.2,2.6,9509\n";

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

describe(
  "AdpService",

  () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-10T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(
      "parses the Redraft SF ADP column keyed by Sleeper player id",

      async () => {
        const adpClient = createFakeAdpClient(SAMPLE_CSV);
        const service = new AdpService(adpClient as never);

        const snapshot = await service.getSnapshot();

        expect(snapshot.get("9221")).toBe(1.5);
        expect(snapshot.get("9509")).toBe(2.6);
        expect(adpClient.getAdpCsv).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "does not refetch within the refresh interval",

      async () => {
        const adpClient = createFakeAdpClient(SAMPLE_CSV);
        const service = new AdpService(adpClient as never);

        await service.getSnapshot();
        await service.getSnapshot();

        expect(adpClient.getAdpCsv).toHaveBeenCalledTimes(1);
      },
    );

    it(
      "serves the last-known snapshot when a refresh fails",

      async () => {
        const adpClient = createFakeAdpClient(SAMPLE_CSV);
        const service = new AdpService(adpClient as never);

        await service.getSnapshot();

        vi.advanceTimersByTime(25 * 60 * 60 * 1000);

        adpClient.getAdpCsv.mockRejectedValueOnce(
          new Error("network error"),
        );

        const snapshot = await service.getSnapshot();

        expect(snapshot.get("9221")).toBe(1.5);
      },
    );

    it(
      "returns an empty snapshot rather than throwing on first-ever failure",

      async () => {
        const adpClient = createFakeAdpClient(
          new Error("network error"),
        );
        const service = new AdpService(adpClient as never);

        const snapshot = await service.getSnapshot();

        expect(snapshot.size).toBe(0);
      },
    );
  },
);