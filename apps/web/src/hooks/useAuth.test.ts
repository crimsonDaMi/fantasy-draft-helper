import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "./useAuth";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  onUnauthorized: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  getCurrentUser: mocks.getCurrentUser,
  login: mocks.login,
  logout: mocks.logout,
  register: mocks.register,
  onUnauthorized: mocks.onUnauthorized,
}));

describe("useAuth session-expiry handling", () => {
  let capturedListener: (() => void) | undefined;

  beforeEach(() => {
    capturedListener = undefined;

    mocks.onUnauthorized.mockImplementation((listener: () => void) => {
      capturedListener = listener;
      return () => {
        capturedListener = undefined;
      };
    });

    mocks.getCurrentUser.mockResolvedValue({ id: "1", username: "alice" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("clears the user and sets a session-expired message when notified", async () => {
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({ id: "1", username: "alice" });

    act(() => {
      capturedListener?.();
    });

    expect(result.current.user).toBeUndefined();
    expect(result.current.error).toBe(
      "Your session expired. Please log in again.",
    );
  });

  it("subscribes to onUnauthorized on mount", async () => {
    renderHook(() => useAuth());

    await waitFor(() => expect(mocks.onUnauthorized).toHaveBeenCalledTimes(1));
  });
});
