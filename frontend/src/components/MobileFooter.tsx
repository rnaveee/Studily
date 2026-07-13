import { Link, NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type SubLink = { label: string; to: string };

export default function MobileFooter({
  nav,
  subLinks,
  dots,
  hidden,
  onCopyrightTap,
}: {
  nav: NavItem[];
  subLinks: SubLink[];
  dots: Record<string, boolean>;
  hidden: boolean;
  onCopyrightTap: () => void;
}) {
  if (hidden) return null;
  return (
    <footer
      className="md:hidden shrink-0"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <nav className="grid grid-cols-6">
        {nav.map(({ to, label, icon: Icon, end }) => (
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
              {dots[to] && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red" />
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-2 text-center" style={{ borderTop: "1px solid var(--line)" }}>
        <div className="flex items-center justify-center gap-4">
          {subLinks.map(({ label, to }) => (
            <Link key={to} to={to} className="text-[11px] text-fg-3 transition-colors hover:text-fg">
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-2 text-[10px] text-fg-3" onClick={onCopyrightTap}>
          © {new Date().getFullYear()} Ryan Nave
        </div>
      </div>
    </footer>
  );
}
