import type { MouseEvent } from "react";

export function useDoubleTap(onDoubleTap: () => void) {
  return {
    onDoubleClick: onDoubleTap,
    onMouseDown: (e: MouseEvent) => {
      if (e.detail > 1) e.preventDefault();
    },
    style: { touchAction: "manipulation" as const },
  };
}
