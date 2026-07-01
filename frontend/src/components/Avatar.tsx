interface AvatarProps {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size: number;
  className?: string;
}

export default function Avatar({ name, username, avatarUrl, size, className = "" }: AvatarProps) {
  const style = { width: size, height: size };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? username ?? "avatar"}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={style}
      />
    );
  }

  const initial = (name ?? username ?? "?").charAt(0).toUpperCase();
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-accent-fg ${className}`}
      style={{ ...style, background: "var(--accent)" }}
    >
      {initial}
    </div>
  );
}
