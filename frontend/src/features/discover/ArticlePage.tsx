import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronDown } from "lucide-react";

export interface ArticleSection {
  id: string;
  title: string;
  eyebrow?: string;
  body: ReactNode;
}

function TocLinks({
  sections,
  active,
  onPick,
}: {
  sections: ArticleSection[];
  active: string | undefined;
  onPick: (e: MouseEvent<HTMLAnchorElement>, id: string) => void;
}) {
  return (
    <ul className="space-y-0.5 border-l border-line">
      {sections.map((s) => {
        const current = s.id === active;
        return (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => onPick(e, s.id)}
              aria-current={current ? "location" : undefined}
              className={[
                "-ml-px block border-l-2 py-1.5 pl-3 text-[13px] leading-snug transition-colors",
                current
                  ? "border-accent font-medium text-accent"
                  : "border-transparent text-fg-3 hover:text-fg",
              ].join(" ")}
            >
              {s.title}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function ArticlePage({
  title,
  intro,
  sections,
  wide = false,
}: {
  title: string;
  intro: ReactNode;
  sections: ArticleSection[];
  wide?: boolean;
}) {
  const [active, setActive] = useState(sections[0]?.id);
  const [tocOpen, setTocOpen] = useState(false);
  const pickedAt = useRef(0);
  const ids = sections.map((s) => s.id).join(" ");

  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    pickedAt.current = Date.now();
    setActive(id);
  }, []);

  useEffect(() => {
    const order = ids.split(" ");
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = order.find((id) => visible.has(id));
        if (first && Date.now() - pickedAt.current > 1000) setActive(first);
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    for (const id of order) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  function pick(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    setTocOpen(false);
    pickedAt.current = Date.now();
    setActive(id);
    document.getElementById(id)?.scrollIntoView();
    window.history.replaceState(window.history.state, "", `#${id}`);
  }

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
      <aside className="hidden lg:block">
        <nav aria-label="On this page" className="sticky top-20">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-3">On this page</p>
          <TocLinks sections={sections} active={active} onPick={pick} />
        </nav>
      </aside>

      <article className="min-w-0 animate-in">
        <Link
          to="/discover"
          className="inline-flex items-center gap-1 text-[13px] text-fg-3 transition-colors hover:text-fg"
        >
          <ArrowLeft size={13} />
          Discover
        </Link>
        <h1 className="display mt-3 text-3xl font-bold text-fg sm:text-4xl">{title}</h1>
        <div className="measure mt-3 text-[15px] leading-relaxed text-fg-2">{intro}</div>

        <nav aria-label="On this page" className="card mt-6 lg:hidden">
          <button
            type="button"
            onClick={() => setTocOpen((o) => !o)}
            aria-expanded={tocOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium text-fg"
          >
            On this page
            <ChevronDown
              size={16}
              className={`text-fg-3 transition-transform ${tocOpen ? "rotate-180" : ""}`}
            />
          </button>
          {tocOpen && (
            <div className="px-4 pb-3">
              <TocLinks sections={sections} active={active} onPick={pick} />
            </div>
          )}
        </nav>

        {sections.map((s, n) => (
          <section
            key={s.id}
            id={s.id}
            className={`scroll-mt-20 ${n === 0 ? "mt-10" : "mt-14 border-t border-line pt-12"}`}
          >
            {s.eyebrow && (
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent">{s.eyebrow}</p>
            )}
            <h2 className="text-xl font-semibold text-fg sm:text-2xl">
              <a href={`#${s.id}`} onClick={(e) => pick(e, s.id)} className="hover:text-accent">
                {s.title}
              </a>
            </h2>
            <div
              className={`${wide ? "" : "measure"} mt-4 space-y-6 text-[15px] leading-relaxed text-fg-2`}
            >
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
