import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NextPick } from "../utils/draft-order";
import type { PickAlertSettings } from "../utils/pick-alerts";
import { useOnTheClockAlerts } from "./useOnTheClockAlerts";

const mocks = vi.hoisted(() => ({ playAlertSound: vi.fn() }));

vi.mock("../utils/alert-sound", () => ({
  playAlertSound: mocks.playAlertSound,
}));

function nextPick(pickNo: number, picksUntil: number): NextPick {
  return { pickNo, round: 1, pickInRound: pickNo, picksUntil, traded: false };
}

const allOn: PickAlertSettings = {
  sound: true,
  notification: true,
  distance: 2,
};

describe("useOnTheClockAlerts", () => {
  const notification = vi.fn();

  beforeEach(() => {
    document.title = "Draft helper";
    vi.stubGlobal(
      "Notification",
      Object.assign(notification, { permission: "granted" }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("counts down in the tab title and resets it once the user has picked", () => {
    const { rerender, unmount } = renderHook(
      ({ next }) => useOnTheClockAlerts(next, 4, allOn),
      { initialProps: { next: nextPick(3, 9) as NextPick | undefined } },
    );

    expect(document.title).toBe("Draft helper");

    rerender({ next: nextPick(3, 2) });
    expect(document.title).toBe("(Up in 2) Draft helper");

    rerender({ next: nextPick(3, 0) });
    expect(document.title).toBe("(ON THE CLOCK) Draft helper");

    // Picked: the next pick is a round away.
    rerender({ next: nextPick(6, 7) });
    expect(document.title).toBe("Draft helper");

    rerender({ next: nextPick(6, 1) });
    unmount();
    expect(document.title).toBe("Draft helper");
  });

  it("fires the sound and notification once per pick, not on every poll", () => {
    const { rerender } = renderHook(
      ({ next }) => useOnTheClockAlerts(next, 4, allOn),
      { initialProps: { next: nextPick(3, 3) } },
    );

    expect(mocks.playAlertSound).not.toHaveBeenCalled();

    rerender({ next: nextPick(3, 2) });
    rerender({ next: nextPick(3, 2) });
    rerender({ next: nextPick(3, 1) });
    rerender({ next: nextPick(3, 0) });

    expect(mocks.playAlertSound).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledTimes(1);
    expect(notification).toHaveBeenCalledWith("You pick in 2 (1.03)", {
      tag: "draft-helper-pick",
    });

    rerender({ next: nextPick(6, 2) });
    expect(mocks.playAlertSound).toHaveBeenCalledTimes(2);
  });

  it("stays quiet with sound and notifications off", () => {
    renderHook(() =>
      useOnTheClockAlerts(nextPick(3, 0), 4, {
        sound: false,
        notification: false,
        distance: 2,
      }),
    );

    expect(mocks.playAlertSound).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it("shows no notification without permission", () => {
    vi.stubGlobal(
      "Notification",
      Object.assign(notification, { permission: "denied" }),
    );

    renderHook(() => useOnTheClockAlerts(nextPick(3, 0), 4, allOn));

    expect(mocks.playAlertSound).toHaveBeenCalledTimes(1);
    expect(notification).not.toHaveBeenCalled();
  });
});
