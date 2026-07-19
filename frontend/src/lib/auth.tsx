import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, setToken, isGuestMode, setGuestMode } from "./api";
import { queryClient } from "./queryClient";
import { syncPush } from "./push";
import { ws } from "./ws";
import type { AuthResponse, User } from "../types";

interface AuthState {
  user: User | null;
  guest: boolean;
  loading: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(isGuestMode);
  const [loading, setLoading] = useState(true);
  const pushSynced = useRef(false);

  useEffect(() => {
    if (user && !pushSynced.current) {
      pushSynced.current = true;
      syncPush().catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/me")
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
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
    setUser(res.user);
  }

  async function signup(input: SignupInput) {
    const res = await api.post<AuthResponse>("/auth/signup", input);
    setToken(res.token);
    clearGuest();
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
    queryClient.clear();
  }

  async function refresh() {
    if (!getToken()) return;
    const u = await api.get<User>("/me");
    setUser(u);
  }

  return (
    <AuthContext.Provider
      value={{ user, guest, loading, login, signup, logout, continueAsGuest, setUser, refresh }}
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
