import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, getToken, setToken, tokenExpiresAt, isGuestMode, setGuestMode } from "./api";
import { queryClient } from "./queryClient";
import { syncPush } from "./push";
import { syncTimeZone } from "./timezone";
import { ws } from "./ws";
import type { AuthResponse, User } from "../types";

const SLIDING_REFRESH_MS = 15 * 24 * 60 * 60 * 1000;
const BOOT_RETRY_DELAY_MS = 1200;

interface AuthState {
  user: User | null;
  guest: boolean;
  loading: boolean;
  expired: boolean;
  bootFailed: boolean;
  retry: () => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
  continueAsGuest: () => void;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
}

export interface SignupInput {
  email: string;
  username: string;
  password: string;
  name: string;
  school?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function slideToken() {
  const expiresAt = tokenExpiresAt();
  if (expiresAt == null || expiresAt - Date.now() > SLIDING_REFRESH_MS) return;
  try {
    const res = await api.post<AuthResponse>("/me/token");
    setToken(res.token);
  } catch {
    return;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(isGuestMode);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [bootFailed, setBootFailed] = useState(false);
  const [bootNonce, setBootNonce] = useState(0);
  const pushSynced = useRef(false);

  useEffect(() => {
    if (user && !pushSynced.current) {
      pushSynced.current = true;
      syncPush().catch(() => {});
      syncTimeZone().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function boot(attempt: number) {
      try {
        const me = await api.get<User>("/me");
        if (cancelled) return;
        setUser(me);
        setBootFailed(false);
        setLoading(false);
        void slideToken();
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setGuestMode(false);
          setGuest(false);
          setExpired(true);
          setLoading(false);
          return;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, BOOT_RETRY_DELAY_MS));
          if (cancelled) return;
          void boot(1);
          return;
        }
        setBootFailed(true);
        setLoading(false);
      }
    }

    setBootFailed(false);
    setLoading(true);
    void boot(0);
    return () => {
      cancelled = true;
    };
  }, [bootNonce]);

  function retry() {
    setBootNonce((n) => n + 1);
  }

  useEffect(() => {
    ws.setUserId(user?.id ?? null);
    if (user?.emailVerified) ws.connect();
    else ws.disconnect();
  }, [user]);

  function clearGuest() {
    setGuestMode(false);
    setGuest(false);
    queryClient.clear();
  }

  async function login(email: string, password: string) {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setToken(res.token);
    clearGuest();
    setExpired(false);
    setUser(res.user);
  }

  async function signup(input: SignupInput) {
    const res = await api.post<AuthResponse>("/auth/signup", input);
    setToken(res.token);
    clearGuest();
    setExpired(false);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    clearGuest();
    setUser(null);
  }

  function continueAsGuest() {
    setGuestMode(true);
    setGuest(true);
    setExpired(false);
    queryClient.clear();
  }

  async function refresh() {
    if (!getToken()) return;
    const u = await api.get<User>("/me");
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        guest,
        loading,
        expired,
        bootFailed,
        retry,
        login,
        signup,
        logout,
        continueAsGuest,
        setUser,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireAuth(): (action: () => void) => void {
  const { user } = useAuth();
  const navigate = useNavigate();
  return (action) => {
    if (user) action();
    else navigate("/login");
  };
}
