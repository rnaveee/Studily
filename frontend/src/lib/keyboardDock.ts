import { useEffect } from "react";

const KEYBOARD_MIN_PX = 120;

const CHECK_DELAYS = [0, 100, 250, 500, 800];

export function useDockToKeyboard(dockRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let timers: number[] = [];
    let shifted: HTMLElement | null = null;

    function clearShift() {
      if (shifted) {
        shifted.style.transform = "";
        shifted = null;
      }
    }

    function correct() {
      const el = dockRef.current;
      if (!el) return;
      const keyboard = root.clientHeight - vv!.height - vv!.offsetTop;
      if (keyboard < KEYBOARD_MIN_PX) {
        clearShift();
        return;
      }
      clearShift();
      const visibleBottom = vv!.offsetTop + vv!.height;
      const gap = visibleBottom - el.getBoundingClientRect().bottom;
      if (Math.abs(gap) <= 2) return;
      const scrollable = Math.min(window.scrollY, Math.max(0, gap));
      if (scrollable > 0) window.scrollTo(0, window.scrollY - scrollable);
      const rest = gap - scrollable;
      if (Math.abs(rest) > 2) {
        el.style.transform = `translateY(${rest}px)`;
        shifted = el;
      }
    }

    function schedule() {
      timers.forEach(clearTimeout);
      timers = CHECK_DELAYS.map((ms) => window.setTimeout(correct, ms));
    }

    schedule();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", schedule);
    return () => {
      timers.forEach(clearTimeout);
      clearShift();
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", schedule);
    };
  }, [dockRef]);
}
