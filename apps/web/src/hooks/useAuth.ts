import { useCallback, useEffect, useState } from "react";

import type { AuthUser } from "../api/fantasy-api";

import {
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

  const login = useCallback(async (username: string, password: string) => {
    setError(undefined);
    try {
      const loggedInUser = await apiLogin(username, password);
      setUser(loggedInUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      throw err;
    }
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    setError(undefined);
    try {
      const registeredUser = await apiRegister(username, password);
      setUser(registeredUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(undefined);
  }, []);

  return { user, isLoading, error, login, register, logout };
}
