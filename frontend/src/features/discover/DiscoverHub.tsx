import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ARTICLES, type Article } from "./articles";

function ArticleCardBody({ article }: { article: Article }) {
  const Icon = article.icon;
  return (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        <Icon size={18} className="text-accent" />
      </span>
      <span className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[15px] font-semibold text-fg">{article.title}</span>
      </span>
      <span className="mt-1.5 block text-[13px] leading-relaxed text-fg-3">{article.summary}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
        Read the guide
        <ArrowRight size={13} strokeWidth={2} />
      </span>
    </>
  );
}

export default function DiscoverHub() {
  return (
    <div className="animate-in">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">Discover</p>
      <h1 className="display mt-2 text-3xl font-bold text-fg sm:text-4xl">Learn how to study with Studily</h1>
      <p className="measure mt-3 text-[15px] leading-relaxed text-fg-2">
        Guides to Studily and how to use it.
      </p>

      <div className="stagger-children mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTICLES.map((article) => (
          <Link
            key={article.slug}
            to={`/discover/${article.slug}`}
            className="card press flex flex-col p-5 transition-colors hover:bg-surface-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ArticleCardBody article={article} />
          </Link>
        ))}
      </div>
    </div>
  );
}
