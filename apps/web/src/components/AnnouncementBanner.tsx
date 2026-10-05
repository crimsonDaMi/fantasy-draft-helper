import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getAnnouncement } from "../api/fantasy-api";
import { readStorage, writeStorage } from "../utils/storage";

const STORAGE_KEY = "draft-helper-dismissed-announcement";

// Open tabs also check again when they regain focus.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** The operator's message to all visitors, e.g. planned downtime. A
 * dismissed message stays hidden in this browser until it changes. */
export function AnnouncementBanner() {
  const { data } = useQuery({
    queryKey: ["announcement"],
    queryFn: getAnnouncement,
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const [dismissed, setDismissed] = useState(() => readStorage(STORAGE_KEY));

  const message = data?.message;

  // Nothing on a failed request either: the banner must never get in the
  // way of the app.
  if (!message || message === dismissed) {
    return null;
  }

  function dismiss(dismissedMessage: string) {
    writeStorage(STORAGE_KEY, dismissedMessage);
    setDismissed(dismissedMessage);
  }

  return (
    <div className="announcement" role="status">
      <p className="announcement__message">{message}</p>
      <button
        type="button"
        className="announcement__dismiss"
        aria-label="Dismiss announcement"
        onClick={() => dismiss(message)}
      >
        ×
      </button>
    </div>
  );
}
