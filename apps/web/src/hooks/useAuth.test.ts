import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "./useAuth";

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  onUnauthorized: vi.fn(),
}));

vi.mock("../api/fantasy-api", () => ({
  changePassword: mocks.changePassword,
  deleteAccount: mocks.deleteAccount,
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

  it("logs out after the account is deleted", async () => {
    mocks.deleteAccount.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined());

    await act(() => result.current.deleteAccount("correct horse battery"));

    expect(mocks.deleteAccount).toHaveBeenCalledWith("correct horse battery");
    expect(result.current.user).toBeUndefined();
  });

  it("changes the password and stays logged in", async () => {
    mocks.changePassword.mockResolvedValue(undefined);
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined());

    await act(() =>
      result.current.changePassword("correct horse battery", "new password1"),
    );

    expect(mocks.changePassword).toHaveBeenCalledWith(
      "correct horse battery",
      "new password1",
    );
    expect(result.current.user).toEqual({ id: "1", username: "alice" });
  });

  it("stays logged in when deleting fails", async () => {
    mocks.deleteAccount.mockRejectedValue(new Error("Incorrect password."));
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).toBeDefined());

    await act(() =>
      expect(result.current.deleteAccount("wrong")).rejects.toThrow(
        "Incorrect password.",
      ),
    );

    expect(result.current.user).toEqual({ id: "1", username: "alice" });
  });
});
