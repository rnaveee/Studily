import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme";

const FOOTER_LINKS = [
  ["Terms", "/terms"],
  ["Privacy", "/privacy"],
  ["Support", "/support"],
];

export default function DiscoverLayout() {
  const { toggle } = useTheme();
  const { pathname } = useLocation();
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.location.hash) scroller.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div ref={scroller} className="h-full overflow-y-auto scroll-smooth motion-reduce:scroll-auto">
      <header
        className="sticky top-0 z-20 border-b border-line backdrop-blur"
        style={{ background: "color-mix(in srgb, var(--bg) 82%, transparent)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link to="/discover" className="flex min-w-0 items-center gap-2">
            <img src="/studily-3a.svg" alt="" className="h-7 w-7 shrink-0" />
            <span className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</span>
            <span className="truncate text-[15px] text-fg-3">Discover</span>
          </Link>
          <nav className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-surface-hi hover:text-fg"
            >
              <Sun size={16} strokeWidth={1.8} className="hidden dark:block" />
              <Moon size={16} strokeWidth={1.8} className="dark:hidden" />
            </button>
            <a href="/" className="btn btn-primary btn-nav">
              Open Studily
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-[12px] text-fg-3">
          <span className="font-mono font-bold text-fg-2">Studily</span>
          {FOOTER_LINKS.map(([label, to]) => (
            <Link key={to} to={to} className="transition-colors hover:text-fg">
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
