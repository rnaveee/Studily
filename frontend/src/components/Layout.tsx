import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  GraduationCap,
  Users2,
  User,
  Sun,
  Moon,
  LogOut,
  LogIn,
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useKeyboardViewport } from "../lib/keyboardDock";
import { useTheme } from "../lib/theme";
import Avatar from "./Avatar";
import Banners from "./Banners";
import type { Conversation, FriendRequestItem } from "../types";

const NAV = [
  { to: "/",           label: "Dashboard",  icon: LayoutDashboard, end: true },
  { to: "/semesters",  label: "Semesters",  icon: GraduationCap },
  { to: "/messages",   label: "Messages",   icon: MessageSquare },
  { to: "/learn",      label: "Learn",      icon: Brain },
  { to: "/friends",    label: "Friends",    icon: Users2 },
  { to: "/profile",    label: "Profile",    icon: User },
];

const SUB_LINKS = [
  { label: "About",   to: "/about" },
  { label: "Terms",   to: "/terms" },
  { label: "Privacy", to: "/privacy" },
  { label: "Support", to: "/support" },
  { label: "Install", to: "/install" },
];

function useTypingInField() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    const onFocusIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onFocusOut = () => setTyping(false);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  return typing;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const typing = useTypingInField();
  useKeyboardViewport();

  const conversations = useQuery({
    queryKey: ["conversations", "list"],
    queryFn: () => api.get<Conversation[]>("/conversations"),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const incomingRequests = useQuery({
    queryKey: ["friends", "incoming"],
    queryFn: () => api.get<FriendRequestItem[]>("/friends/incoming"),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const NAV_DOTS: Record<string, boolean> = {
    "/messages": conversations.data?.some((c) => c.unread) ?? false,
    "/friends": (incomingRequests.data?.length ?? 0) > 0,
  };

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg" style={{ height: "var(--app-height, 100dvh)" }}>
      <aside
        className="hidden md:flex w-[220px] shrink-0 flex-col"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}
      >
        <div className="px-5 py-5">
          <div className="flex items-center gap-1.5">
            <img src="/studily-3a.svg" alt="" className="h-8 w-8" />
            <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
          </div>
          <div className="text-[10px] text-fg-3">by Ryan Nave</div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 select-none",
                  isActive
                    ? "text-accent"
                    : "text-fg-2 hover:bg-surface-hi hover:text-fg",
                ].join(" ")
              }
              style={({ isActive }) =>
                isActive
                  ? { background: "color-mix(in srgb, var(--accent) 10%, transparent)" }
                  : {}
              }
            >
              <span className="relative inline-flex">
                <Icon size={15} strokeWidth={1.8} />
                {NAV_DOTS[to] && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red" />
                )}
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 pb-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {SUB_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className="text-[11px] text-fg-3 transition-colors hover:text-fg"
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-1.5 text-[10px] text-fg-3">
            © {new Date().getFullYear()} Ryan Nave
          </div>
        </div>

        <div className="p-2 space-y-0.5" style={{ borderTop: "1px solid var(--line)" }}>
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-fg-2 transition-all duration-150 hover:bg-surface-hi hover:text-fg"
          >
            {dark
              ? <Sun size={15} strokeWidth={1.8} />
              : <Moon size={15} strokeWidth={1.8} />}
            {dark ? "Light mode" : "Dark mode"}
          </button>

          {user ? (
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-fg-2 transition-all duration-150 hover:bg-surface-hi hover:text-fg"
            >
              <LogOut size={15} strokeWidth={1.8} />
              Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-fg-2 transition-all duration-150 hover:bg-surface-hi hover:text-fg"
            >
              <LogIn size={15} strokeWidth={1.8} />
              Log in
            </Link>
          )}

          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-0.5">
              <Avatar name={user.name} username={user.username} avatarUrl={user.avatarUrl} size={24} className="text-[11px]" />
              <span className="truncate text-[12px] text-fg-2">@{user.username}</span>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex items-center justify-between px-4 pb-2.5 md:hidden"
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--line)",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 18px)",
          }}
        >
          <div className="flex items-center">
            <img src="/studily-3a.svg" alt="" className="h-8 w-8" />
            <div>
              <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
              <div className="text-[9px] leading-tight text-fg-3">by Ryan Nave</div>
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-surface-hi"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>

            {user ? (
              <>
                <NavLink
                  to="/profile"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-fg-2 transition-colors hover:bg-surface-hi"
                >
                  <Avatar name={user.name} username={user.username} avatarUrl={user.avatarUrl} size={20} className="text-[10px]" />
                  <span className="max-w-[80px] truncate">@{user.username}</span>
                </NavLink>

                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-surface-hi"
                  aria-label="Sign out"
                >
                  <LogOut size={16} strokeWidth={1.8} />
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-fg-2 transition-colors hover:bg-surface-hi"
              >
                <LogIn size={16} strokeWidth={1.8} />
                Log in
              </Link>
            )}
          </div>
        </header>

        <Banners />

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div
            className={`mx-auto flex min-h-full max-w-5xl flex-col px-4 pt-6 md:px-10 md:pt-8 md:pb-24 ${
              typing ? "pb-0" : "pb-24"
            }`}
          >
            <Outlet />
          </div>
        </main>

        <footer
          className={typing ? "hidden" : "md:hidden"}
          style={{
            background: "var(--surface)",
            borderTop: "1px solid var(--line)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <nav className="grid grid-cols-6">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                    isActive ? "text-accent" : "text-fg-3",
                  ].join(" ")
                }
              >
                <span className="relative inline-flex">
                  <Icon size={20} strokeWidth={1.8} />
                  {NAV_DOTS[to] && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red" />
                  )}
                </span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div
            className="px-4 py-2 text-center"
            style={{ borderTop: "1px solid var(--line)" }}
          >
            <div className="flex items-center justify-center gap-4">
              {SUB_LINKS.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-[11px] text-fg-3 transition-colors hover:text-fg"
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-fg-3">
              © {new Date().getFullYear()} Ryan Nave
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
