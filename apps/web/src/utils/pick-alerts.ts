import { formatPick, type NextPick } from "./draft-order";
import { readStoredJson, writeStorage } from "./storage";

const STORAGE_KEY = "draft-helper-pick-alerts";

/** The tab title counts down from this many picks before the user's. */
const TITLE_DISTANCE = 5;

/** Furthest distance an alert can be set to. */
export const MAX_ALERT_DISTANCE = 5;

export interface PickAlertSettings {
  sound: boolean;
  notification: boolean;
  /** Alert this many picks before the user's (0: when on the clock). */
  distance: number;
}

export const DEFAULT_PICK_ALERT_SETTINGS: PickAlertSettings = {
  sound: false,
  notification: false,
  distance: 2,
};

/** Alert settings from an earlier page load; off by default, and when
 * storage is blocked. */
export function readPickAlertSettings(): PickAlertSettings {
  const stored = readStoredJson(STORAGE_KEY) as
    Partial<Record<keyof PickAlertSettings, unknown>> | null | undefined;
  const distance = stored?.distance;

  return {
    sound: stored?.sound === true,
    notification: stored?.notification === true,
    distance:
      typeof distance === "number" &&
      Number.isInteger(distance) &&
      distance >= 0 &&
      distance <= MAX_ALERT_DISTANCE
        ? distance
        : DEFAULT_PICK_ALERT_SETTINGS.distance,
  };
}

export function writePickAlertSettings(settings: PickAlertSettings): void {
  writeStorage(STORAGE_KEY, JSON.stringify(settings));
}

/** Tab title prefix for the user's next pick, or undefined while it's
 * further away. */
export function pickTitlePrefix(picksUntil: number): string | undefined {
  if (picksUntil === 0) {
    return "(ON THE CLOCK)";
  }

  return picksUntil <= TITLE_DISTANCE ? `(Up in ${picksUntil})` : undefined;
}

/** Worded like My team's next-pick line. */
export function pickAlertMessage(next: NextPick, teams?: number): string {
  const label = formatPick(next.pickNo, teams);

  return next.picksUntil === 0
    ? `You're on the clock (${label})`
    : `You pick in ${next.picksUntil} (${label})`;
}
