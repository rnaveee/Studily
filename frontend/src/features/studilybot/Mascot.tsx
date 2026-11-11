import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import StudilyBot from "../../components/StudilyBot";
import { BOT_STARTER, type BotExpression, type BotPose } from "../../lib/botArt";
import { useAuth } from "../../lib/auth";
import { prefersReducedMotion } from "../../lib/motion";
import type { BotOutfitRef } from "../../types";

export type MascotState =
  | "idle"
  | "wave"
  | "thinking"
  | "explaining"
  | "happy"
  | "excited"
  | "highfive"
  | "love"
  | "confused"
  | "sleepy"
  | "spin";

const STATES: Record<MascotState, { pose: BotPose; expression: BotExpression; motion: string }> = {
  idle: { pose: "idle", expression: "happy", motion: "sway" },
  wave: { pose: "wave", expression: "happy", motion: "sway" },
  thinking: { pose: "think", expression: "curious", motion: "think" },
  explaining: { pose: "wave", expression: "happy", motion: "talk" },
  happy: { pose: "idle", expression: "happy", motion: "bounce" },
  excited: { pose: "cheer", expression: "proud", motion: "hop" },
  highfive: { pose: "wave", expression: "proud", motion: "lean" },
  love: { pose: "wave", expression: "love", motion: "sway" },
  confused: { pose: "think", expression: "curious", motion: "tilt" },
  sleepy: { pose: "idle", expression: "sleepy", motion: "breathe" },
  spin: { pose: "cheer", expression: "happy", motion: "spin" },
};

export function useMascotReaction(): [MascotState | null, (state: MascotState, ms?: number) => void] {
  const [reaction, setReaction] = useState<MascotState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const react = useCallback((state: MascotState, ms = 2200) => {
    window.clearTimeout(timer.current);
    setReaction(state);
    timer.current = window.setTimeout(() => setReaction(null), ms);
  }, []);
  return [reaction, react];
}

export function useEquippedOutfit(): BotOutfitRef {
  const { user } = useAuth();
  return user?.botOutfit ?? BOT_STARTER;
}

export default function Mascot({
  state = "idle",
  size = 120,
  say,
  shadow = false,
  outfit,
  crop = "full",
  label,
  still = false,
  className = "",
}: {
  state?: MascotState;
  size?: number;
  say?: ReactNode;
  shadow?: boolean;
  outfit?: BotOutfitRef;
  crop?: "full" | "head";
  label?: string;
  still?: boolean;
  className?: string;
}) {
  const equipped = useEquippedOutfit();
  const worn = outfit ?? equipped;
  const s = STATES[state];
  const moving = !still && !prefersReducedMotion();

  return (
    <span className={`mascot inline-flex flex-col items-center ${className}`}>
      {say != null && (
        <span key={String(say)} className="mascot-bubble mb-2 max-w-[16rem] text-center">
          {say}
        </span>
      )}
      <span className={`mascot-figure ${moving ? `mascot-${s.motion}` : ""}`} style={{ lineHeight: 0 }}>
        <StudilyBot
          pose={s.pose}
          expression={s.expression}
          top={worn.top}
          bottom={worn.bottom}
          size={size}
          crop={crop}
          animate={moving}
          title={label}
        />
      </span>
      {shadow && <span className="mascot-shadow" style={{ width: size * 0.55 }} aria-hidden="true" />}
    </span>
  );
}
