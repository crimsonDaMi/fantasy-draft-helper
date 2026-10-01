import { useCallback, useEffect, useState } from "react";

import type { AuthUser } from "../api/fantasy-api";
import {
  deleteAccount as apiDeleteAccount,
  getCurrentUser,
  onUnauthorized,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from "../api/fantasy-api";

interface UseAuthResult {
  user?: AuthUser;
  isLoading: boolean;
  error?: string;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Rejects (leaving the user logged in) if the password is wrong. */
  deleteAccount: (password: string) => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(undefined))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(undefined);
      setError("Your session expired. Please log in again.");
    });
  }, []);

  const authenticate = useCallback(
    async (
      apiCall: () => Promise<AuthUser>,
      fallbackMessage: string,
    ): Promise<void> => {
      setError(undefined);
      try {
        setUser(await apiCall());
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
        throw err;
      }
    },
    [],
  );

  const login = useCallback(
    (username: string, password: string) =>
      authenticate(() => apiLogin(username, password), "Login failed."),
    [authenticate],
  );

  const register = useCallback(
    (username: string, password: string) =>
      authenticate(
        () => apiRegister(username, password),
        "Registration failed.",
      ),
    [authenticate],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(undefined);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await apiDeleteAccount(password);
    setUser(undefined);
  }, []);

  return { user, isLoading, error, login, register, logout, deleteAccount };
}
