import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import { syncPush } from "./push";
import { ws } from "./ws";
import type { AuthResponse, User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => void;
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

  async function login(email: string, password: string) {
    const res = await api.post<AuthResponse>("/auth/login", { email, password });
    setToken(res.token);
    setUser(res.user);
  }

  async function signup(input: SignupInput) {
    const res = await api.post<AuthResponse>("/auth/signup", input);
    setToken(res.token);
    setUser(res.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  async function refresh() {
    if (!getToken()) return;
    const u = await api.get<User>("/me");
    setUser(u);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
