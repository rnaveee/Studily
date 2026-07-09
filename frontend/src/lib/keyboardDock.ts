import { useEffect } from "react";

const KEYBOARD_MIN_PX = 120;

const CHECK_DELAYS = [0, 100, 250, 500, 800];

export function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let timers: number[] = [];

    function apply() {
      const keyboard = root.clientHeight - vv!.height - vv!.offsetTop;
      if (keyboard >= KEYBOARD_MIN_PX) {
        root.style.setProperty("--app-height", `${Math.round(vv!.height)}px`);
        root.style.setProperty("--kb-inset", "0px");
        if (vv!.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0);
      } else {
        root.style.removeProperty("--app-height");
        root.style.removeProperty("--kb-inset");
      }
    }

    function schedule() {
      timers.forEach(clearTimeout);
      timers = CHECK_DELAYS.map((ms) => window.setTimeout(apply, ms));
    }

    schedule();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", schedule);
    return () => {
      timers.forEach(clearTimeout);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--kb-inset");
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", schedule);
    };
  }, []);
}
