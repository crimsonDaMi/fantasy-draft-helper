import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_PICK_ALERT_SETTINGS,
  pickAlertMessage,
  pickTitlePrefix,
  readPickAlertSettings,
  writePickAlertSettings,
} from "./pick-alerts";

describe("pick alerts", () => {
  afterEach(() => window.localStorage.clear());

  it("counts down in the tab title only when the pick is near", () => {
    expect(pickTitlePrefix(0)).toBe("(ON THE CLOCK)");
    expect(pickTitlePrefix(2)).toBe("(Up in 2)");
    expect(pickTitlePrefix(5)).toBe("(Up in 5)");
    expect(pickTitlePrefix(6)).toBeUndefined();
  });

  it("words the alert like the next-pick line", () => {
    const next = { pickNo: 7, round: 2, pickInRound: 3, traded: false };

    expect(pickAlertMessage({ ...next, picksUntil: 0 }, 4)).toBe(
      "You're on the clock (2.03)",
    );
    expect(pickAlertMessage({ ...next, picksUntil: 2 }, 4)).toBe(
      "You pick in 2 (2.03)",
    );
  });

  it("keeps sound and notifications off by default", () => {
    expect(readPickAlertSettings()).toEqual(DEFAULT_PICK_ALERT_SETTINGS);
    expect(DEFAULT_PICK_ALERT_SETTINGS.sound).toBe(false);
    expect(DEFAULT_PICK_ALERT_SETTINGS.notification).toBe(false);
  });

  it("round-trips settings and ignores invalid stored values", () => {
    writePickAlertSettings({ sound: true, notification: true, distance: 0 });
    expect(readPickAlertSettings()).toEqual({
      sound: true,
      notification: true,
      distance: 0,
    });

    window.localStorage.setItem(
      "draft-helper-pick-alerts",
      JSON.stringify({ sound: "yes", distance: 99 }),
    );
    expect(readPickAlertSettings()).toEqual(DEFAULT_PICK_ALERT_SETTINGS);
  });
});
