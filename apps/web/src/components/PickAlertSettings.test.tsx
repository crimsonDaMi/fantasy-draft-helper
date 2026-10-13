import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PICK_ALERT_SETTINGS } from "../utils/pick-alerts";
import { PickAlertSettings } from "./PickAlertSettings";

const mocks = vi.hoisted(() => ({ playAlertSound: vi.fn() }));

vi.mock("../utils/alert-sound", () => ({
  playAlertSound: mocks.playAlertSound,
}));

function stubNotification(
  permission: NotificationPermission,
  answer: NotificationPermission = permission,
) {
  const requestPermission = vi.fn(async () => answer);
  vi.stubGlobal(
    "Notification",
    Object.assign(vi.fn(), { permission, requestPermission }),
  );
  return requestPermission;
}

describe("PickAlertSettings", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("asks for notification permission only once the user opts in", async () => {
    const requestPermission = stubNotification("default", "granted");
    const onChange = vi.fn();

    render(
      <PickAlertSettings
        settings={DEFAULT_PICK_ALERT_SETTINGS}
        onChange={onChange}
      />,
    );

    expect(requestPermission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Notification" }));

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({
        ...DEFAULT_PICK_ALERT_SETTINGS,
        notification: true,
      }),
    );
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("leaves notifications off when the browser blocks them", async () => {
    stubNotification("default", "denied");
    const onChange = vi.fn();

    render(
      <PickAlertSettings
        settings={DEFAULT_PICK_ALERT_SETTINGS}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Notification" }));

    expect(
      await screen.findByText(/notifications are blocked/i),
    ).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("plays a preview when the sound is turned on, and sets the distance", () => {
    const onChange = vi.fn();

    render(
      <PickAlertSettings
        settings={DEFAULT_PICK_ALERT_SETTINGS}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Sound" }));
    expect(mocks.playAlertSound).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_PICK_ALERT_SETTINGS,
      sound: true,
    });

    fireEvent.change(screen.getByLabelText("When to alert"), {
      target: { value: "0" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      ...DEFAULT_PICK_ALERT_SETTINGS,
      distance: 0,
    });
  });

  it("leaves out notifications where the browser has none", () => {
    render(
      <PickAlertSettings
        settings={DEFAULT_PICK_ALERT_SETTINGS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("checkbox", { name: "Notification" })).toBeNull();
  });
});
