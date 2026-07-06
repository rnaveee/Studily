import { useEffect } from "react";

// Threshold for treating the visual-viewport shrink as an on-screen keyboard rather
// than browser chrome showing/hiding (which is usually under ~100px).
const KEYBOARD_MIN_PX = 120;

// Moments (ms after focus/blur) to re-assert the layout. iOS applies its own
// "scroll the focused input into view" adjustments asynchronously while the keyboard
// animates, so a single correction gets overwritten — it has to be re-applied
// across the whole animation window.
const REASSERT_DELAYS = [0, 50, 150, 300, 500, 700];

// Keeps --app-height/--app-offset-top custom properties in sync with the visible viewport.
// Mobile browsers (especially iOS Safari) don't shrink 100dvh when the on-screen keyboard
// opens. Instead they scroll/pan the page to reveal the focused input, which visually shoves
// the whole app up with the input stranded mid-screen. To keep the screen still and dock the
// input on the keyboard, the app shell must (a) shrink to visualViewport.height, (b) translate
// down by visualViewport.offsetTop to cancel any pan the scroll reset can't undo, and (c) keep
// window scroll pinned to 0.
//
// Also stamps data-keyboard="open" on <html> while the keyboard is up, so chrome that should
// stay hidden behind the keyboard (the mobile tab bar) can opt out via the .kb-hide utility
// instead of riding up on top of the keyboard.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let timers: number[] = [];

    function apply() {
      const height = vv ? vv.height : window.innerHeight;
      const offsetTop = vv ? vv.offsetTop : 0;
      // documentElement.clientHeight is the layout viewport, which keyboards don't shrink —
      // window.innerHeight tracks the visual viewport on iOS, so it can't be the baseline.
      const keyboardInset = root.clientHeight - height;
      root.style.setProperty("--app-height", `${height}px`);
      root.style.setProperty("--app-offset-top", `${offsetTop}px`);
      if (keyboardInset > KEYBOARD_MIN_PX) {
        root.dataset.keyboard = "open";
      } else {
        delete root.dataset.keyboard;
      }
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    }

    function reassert() {
      timers.forEach(clearTimeout);
      timers = REASSERT_DELAYS.map((ms) => window.setTimeout(apply, ms));
    }

    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("focusin", reassert);
    window.addEventListener("focusout", reassert);
    return () => {
      timers.forEach(clearTimeout);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("focusin", reassert);
      window.removeEventListener("focusout", reassert);
      delete root.dataset.keyboard;
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--app-offset-top");
    };
  }, []);
}

// Re-pins a scroll container to its bottom sentinel whenever the keyboard opens or closes,
// so the latest messages stay visible as the space above the keyboard changes.
export function usePinToBottomOnKeyboard(bottomRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => bottomRef.current?.scrollIntoView({ block: "end" });
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [bottomRef]);
}
