import { useState } from "react";

import { notificationsGranted } from "../hooks/useOnTheClockAlerts";
import { playAlertSound } from "../utils/alert-sound";
import {
  MAX_ALERT_DISTANCE,
  type PickAlertSettings as Settings,
} from "../utils/pick-alerts";

interface PickAlertSettingsProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

/** Opt-in sound and browser notification for when the user's pick is
 * near. Notification permission is only asked for when turning
 * notifications on. */
export function PickAlertSettings({
  settings,
  onChange,
}: PickAlertSettingsProps) {
  const [notice, setNotice] = useState<string>();
  const notificationsSupported = typeof window.Notification === "function";

  async function changeNotification(enabled: boolean) {
    setNotice(undefined);

    if (!enabled) {
      onChange({ ...settings, notification: false });
      return;
    }

    let permission = window.Notification.permission;

    if (permission === "default") {
      permission = await window.Notification.requestPermission();
    }

    if (permission === "granted") {
      onChange({ ...settings, notification: true });
    } else {
      setNotice(
        "Notifications are blocked for this site; allow them in your browser's site settings.",
      );
    }
  }

  return (
    <fieldset className="pick-alerts">
      <legend>Alert me</legend>
      <select
        className="select"
        aria-label="When to alert"
        value={settings.distance}
        onChange={(event) =>
          onChange({ ...settings, distance: Number(event.target.value) })
        }
      >
        {Array.from({ length: MAX_ALERT_DISTANCE + 1 }, (_, distance) => (
          <option key={distance} value={distance}>
            {distance === 0
              ? "when I'm on the clock"
              : `${distance} pick${distance === 1 ? "" : "s"} before mine`}
          </option>
        ))}
      </select>
      <label>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(event) => {
            onChange({ ...settings, sound: event.target.checked });
            // A preview, which also lets the browser play later alerts.
            if (event.target.checked) {
              playAlertSound();
            }
          }}
        />{" "}
        Sound
      </label>
      {notificationsSupported && (
        <label>
          <input
            type="checkbox"
            checked={settings.notification && notificationsGranted()}
            onChange={(event) => void changeNotification(event.target.checked)}
          />{" "}
          Notification
        </label>
      )}
      {notice && <p className="pick-alerts__notice">{notice}</p>}
    </fieldset>
  );
}
