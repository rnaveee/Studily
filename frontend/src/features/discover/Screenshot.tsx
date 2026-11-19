export default function Screenshot({
  name,
  alt,
  width,
  height,
  className = "",
}: {
  name: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <img
      src={`/discover-images/${name}.webp`}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      className={`h-auto w-full rounded-2xl border border-line bg-surface shadow-[var(--shadow-md)] ${className}`}
    />
  );
}
