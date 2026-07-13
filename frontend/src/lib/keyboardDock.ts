import { useEffect } from "react";

const KEYBOARD_MIN_PX = 120;

const CHECK_DELAYS = [0, 100, 250, 500, 800];

function measureSafeTop() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:1px;visibility:hidden;pointer-events:none";
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return h;
}

export function useKeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let timers: number[] = [];

    function apply() {
      const active = document.activeElement;
      const editing =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable);
      const keyboard = root.clientHeight - vv!.height - vv!.offsetTop;
      if (editing && keyboard >= KEYBOARD_MIN_PX) {
        root.style.setProperty("--app-height", `${Math.round(vv!.height)}px`);
        root.style.setProperty("--composer-pb", "6px");
        if (vv!.offsetTop > 0 || window.scrollY > 0) window.scrollTo(0, 0);
      } else {
        const standalone = window.matchMedia("(display-mode: standalone)").matches;
        const portrait = window.matchMedia("(orientation: portrait)").matches;
        const deficit = window.screen.height - root.clientHeight;
        const safeTop = measureSafeTop();
        if (
          standalone &&
          portrait &&
          vv!.scale === 1 &&
          safeTop > 0 &&
          Math.abs(deficit - safeTop) <= 2
        ) {
          root.style.setProperty("--app-height", `${window.screen.height}px`);
        } else if (vv!.scale === 1 && vv!.height - root.clientHeight > 1) {
          root.style.setProperty("--app-height", `${Math.round(vv!.height)}px`);
        } else {
          root.style.removeProperty("--app-height");
        }
        root.style.removeProperty("--composer-pb");
        if (window.scrollY > 0) window.scrollTo(0, 0);
      }
    }

    function schedule() {
      timers.forEach(clearTimeout);
      timers = CHECK_DELAYS.map((ms) => window.setTimeout(apply, ms));
    }

    schedule();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", schedule);
    return () => {
      timers.forEach(clearTimeout);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--composer-pb");
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", schedule);
    };
  }, []);
}
