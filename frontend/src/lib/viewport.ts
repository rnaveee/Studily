import { useEffect } from "react";

// Threshold for treating the visual-viewport shrink as an on-screen keyboard rather
// than browser chrome showing/hiding (which is usually under ~100px).
const KEYBOARD_MIN_PX = 120;

// Keeps a --app-height custom property in sync with the visible viewport. Mobile browsers
// (especially iOS Safari) don't shrink 100dvh when the on-screen keyboard opens — instead they
// pan the visual viewport, which makes a fixed-height app shell appear to scroll the whole
// screen with the focused input stranded mid-page. Tracking window.visualViewport lets the
// shell shrink to what's actually visible, so the keyboard just docks below it like a native app.
//
// Also stamps data-keyboard="open" on <html> while the keyboard is up, so chrome that should
// stay hidden behind the keyboard (the mobile tab bar) can opt out of the shrunken shell
// via the .kb-hide utility instead of riding up on top of the keyboard.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    function update() {
      const height = vv ? vv.height : window.innerHeight;
      // documentElement.clientHeight is the layout viewport, which keyboards don't shrink —
      // window.innerHeight tracks the visual viewport on iOS, so it can't be the baseline.
      const keyboardInset = root.clientHeight - height;
      root.style.setProperty("--app-height", `${height}px`);
      if (keyboardInset > KEYBOARD_MIN_PX) {
        root.dataset.keyboard = "open";
      } else {
        delete root.dataset.keyboard;
      }
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    }

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      delete root.dataset.keyboard;
      root.style.removeProperty("--app-height");
    };
  }, []);
}
