import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Users2,
  User,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";

const NAV = [
  { to: "/",           label: "Dashboard",  icon: LayoutDashboard, end: true },
  { to: "/calendar",   label: "Calendar",   icon: CalendarDays },
  { to: "/courses",    label: "Courses",    icon: BookOpen },
  { to: "/semesters",  label: "Semesters",  icon: GraduationCap },
  { to: "/classmates", label: "Classmates", icon: Users2 },
  { to: "/profile",    label: "Profile",    icon: User },
];

const SUB_LINKS = [
  { label: "About",   to: "/about" },
  { label: "Terms",   to: "/terms" },
  { label: "Privacy", to: "/privacy" },
  { label: "Support", to: "/support" },
  { label: "Install", to: "/install" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initial = (user?.name ?? user?.username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex w-[220px] shrink-0 flex-col"
        style={{ background: "var(--surface)", borderRight: "1px solid var(--line)" }}
      >
        <div className="px-5 py-5">
          <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
          <div className="text-[10px] text-fg-3">by ryan nave</div>
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
              <Icon size={15} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-wrap gap-x-3 gap-y-1 px-5 pb-3">
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

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-fg-2 transition-all duration-150 hover:bg-surface-hi hover:text-fg"
          >
            <LogOut size={15} strokeWidth={1.8} />
            Sign out
          </button>

          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 mt-0.5">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {initial}
              </div>
              <span className="truncate text-[12px] text-fg-2">@{user.username}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Right panel — flex column, fills remaining space */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header
          className="flex items-center justify-between px-4 py-2.5 md:hidden"
          style={{ background: "var(--surface)", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
            <div className="text-[9px] leading-tight text-fg-3">by ryan nave</div>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-surface-hi"
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
            </button>

            <NavLink
              to="/profile"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-fg-2 transition-colors hover:bg-surface-hi"
            >
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
              >
                {initial}
              </div>
              <span className="max-w-[80px] truncate">@{user?.username}</span>
            </NavLink>

            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-fg-2 transition-colors hover:bg-surface-hi"
              aria-label="Sign out"
            >
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        {/* Main scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 md:px-10 md:py-8">
            <Outlet />
          </div>
        </main>

        {/* Mobile footer */}
        <footer
          className="md:hidden"
          style={{ background: "var(--surface)", borderTop: "1px solid var(--line)" }}
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
                <Icon size={20} strokeWidth={1.8} />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div
            className="flex items-center justify-center gap-4 px-4 py-2"
            style={{ borderTop: "1px solid var(--line)" }}
          >
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
        </footer>
      </div>
    </div>
  );
}
