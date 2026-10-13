import { useEffect, useRef } from "react";

import { playAlertSound } from "../utils/alert-sound";
import type { NextPick } from "../utils/draft-order";
import {
  pickAlertMessage,
  pickTitlePrefix,
  type PickAlertSettings,
} from "../utils/pick-alerts";

/** Whether notifications may be shown; false where unsupported. */
export function notificationsGranted(): boolean {
  return (
    typeof window.Notification === "function" &&
    window.Notification.permission === "granted"
  );
}

/** Tells the user their pick is near while they're in another tab: the
 * tab title counts down to it, and the opted-in sound and notification
 * fire once per pick when it comes within the chosen distance. `next` is
 * undefined while there's no pick to count down to (not drafting, an
 * auction, or no known slot), which leaves the title alone. */
export function useOnTheClockAlerts(
  next: NextPick | undefined,
  teams: number | undefined,
  settings: PickAlertSettings,
): void {
  const prefix =
    next === undefined ? undefined : pickTitlePrefix(next.picksUntil);

  useEffect(() => {
    if (prefix === undefined) {
      return;
    }

    const title = document.title;
    document.title = `${prefix} ${title}`;

    return () => {
      document.title = title;
    };
  }, [prefix]);

  // Polling re-renders with the same next pick every few seconds; only
  // a pick not alerted yet fires.
  const alertedPickNo = useRef<number>(undefined);
  const due = next !== undefined && next.picksUntil <= settings.distance;
  const message = next && pickAlertMessage(next, teams);

  useEffect(() => {
    if (
      !due ||
      !message ||
      alertedPickNo.current === next?.pickNo ||
      (!settings.sound && !settings.notification)
    ) {
      return;
    }

    alertedPickNo.current = next?.pickNo;

    if (settings.sound) {
      playAlertSound();
    }

    if (settings.notification && notificationsGranted()) {
      try {
        new window.Notification(message, { tag: "draft-helper-pick" });
      } catch {
        // Some browsers (Android Chrome) only notify from a service worker.
      }
    }
  }, [due, message, next?.pickNo, settings.sound, settings.notification]);
}
