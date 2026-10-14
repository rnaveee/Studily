import { useMemo, useState, type CSSProperties } from "react";
import FlairRing from "./FlairRing";
import FlairSvg from "./FlairSvg";
import { FLAIR_STATIC_MAX, flairRing, ringWidth } from "../lib/flairs";
import { ART_ANIMATE_MIN, ART_SMALL_MAX, buildFlairArt, flairArtKind, type FlairArtKind } from "../lib/flairArt";
import type { FlairRef } from "../types";

interface AvatarProps {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size: number;
  className?: string;
  flair?: FlairRef | null;
  still?: boolean;
}

export default function Avatar({ name, username, avatarUrl, size, className = "", flair, still = false }: AvatarProps) {
  const [failedArt, setFailedArt] = useState<string | null>(null);
  const ring = flairRing(flair?.code);
  const artKind = flairArtKind(flair?.code);
  const art = flair?.imageUrl && flair.imageUrl !== failedArt ? flair.imageUrl : null;

  if (artKind && !art) {
    return (
      <ArtAvatar
        kind={artKind}
        code={flair?.code}
        name={name}
        username={username}
        avatarUrl={avatarUrl}
        size={size}
        className={className}
        still={still}
      />
    );
  }

  if (!ring && !art) {
    return (
      <Face
        name={name}
        username={username}
        avatarUrl={avatarUrl}
        className={className}
        style={{ width: size, height: size }}
      />
    );
  }

  const inner = size - ringWidth(size) * 2;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
      data-flair={flair?.code}
    >
      {!art && ring && <FlairRing ring={ring} size={size} animate={!still && size > FLAIR_STATIC_MAX} />}
      <Face
        name={name}
        username={username}
        avatarUrl={avatarUrl}
        className="relative"
        style={{ width: inner, height: inner, fontSize: `${(inner / size).toFixed(3)}em` }}
      />
      {art && (
        <img
          src={art}
          alt=""
          draggable={false}
          onError={() => setFailedArt(art)}
          className="flair-art absolute inset-0 h-full w-full select-none object-contain"
        />
      )}
    </span>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ArtAvatar({
  kind,
  code,
  name,
  username,
  avatarUrl,
  size,
  className,
  still,
}: {
  kind: FlairArtKind;
  code?: string;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size: number;
  className: string;
  still: boolean;
}) {
  const small = size <= ART_SMALL_MAX;
  const animate = !still && size >= ART_ANIMATE_MIN && !reducedMotion();
  const art = useMemo(() => buildFlairArt(kind, small, !animate), [kind, small, animate]);
  const unit = small ? size / 182 : (size * 0.78) / 152;
  const inner = Math.round(152 * unit);

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ width: size, height: size }}
      data-flair={code}
    >
      <FlairSvg art={art} kind={kind} unit={unit} animate={animate} part="back" />
      <Face
        name={name}
        username={username}
        avatarUrl={avatarUrl}
        className="relative"
        style={{ width: inner, height: inner, fontSize: `${(inner / size).toFixed(3)}em` }}
      />
      <FlairSvg art={art} kind={kind} unit={unit} animate={animate} part="front" />
    </span>
  );
}

function Face({
  name,
  username,
  avatarUrl,
  className,
  style,
}: {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  className: string;
  style: CSSProperties;
}) {
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
