export function Spinner({ size = 14, label }: { size?: number; label?: string }) {
  return (
    <span className="flex items-center gap-2 text-sm text-fg-3">
      <span
        className="inline-block shrink-0 animate-spin rounded-full border-2 border-line border-t-accent"
        style={{ width: size, height: size }}
      />
      {label}
    </span>
  );
}

export function Skeleton({
  className = "",
  width,
  height = 12,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
}) {
  return <span className={`skeleton block ${className}`} style={{ width, height }} />;
}

export function SkeletonList({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`card divide-y divide-line ${className}`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton width={3} height={32} className="shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton width={`${58 + ((i * 13) % 30)}%`} height={11} />
            <Skeleton width={`${34 + ((i * 17) % 24)}%`} height={9} />
          </div>
          <Skeleton width={58} height={18} className="shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({
  count = 3,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-3 p-4">
          <Skeleton width={`${44 + ((i * 19) % 26)}%`} height={13} />
          <Skeleton width="72%" height={9} />
          <Skeleton width="100%" height={6} className="rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 180, className = "" }: { height?: number; className?: string }) {
  return <div className={`card overflow-hidden ${className}`} aria-hidden="true"><Skeleton height={height} className="rounded-none" /></div>;
}
