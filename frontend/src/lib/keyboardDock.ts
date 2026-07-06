import { useEffect } from "react";

// Visual-viewport shrink below this is browser chrome, not a keyboard.
const KEYBOARD_MIN_PX = 120;

// iOS applies its focus scrolling asynchronously across the keyboard animation,
// so the correction has to be re-checked at several points after each event.
const CHECK_DELAYS = [0, 100, 250, 500, 800];

// Measures the real gap between the docked element's bottom edge and the top of the
// on-screen keyboard, and cancels it. iOS — installed PWAs in particular — over-scrolls
// the page when an input gains focus, leaving the input floating above the keyboard by
// a device/OS-dependent amount that no static layout can account for. The correction is
// applied through window scroll where possible and a translateY for any remainder.
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
      clearShift(); // measure from the element's natural position
      const visibleBottom = vv!.offsetTop + vv!.height;
      const gap = visibleBottom - el.getBoundingClientRect().bottom;
      if (Math.abs(gap) <= 2) return;
      // gap > 0: input floats above the keyboard — undo over-scroll first.
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
