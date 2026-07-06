import { useEffect } from "react";

// Threshold for treating the visual-viewport shrink as an on-screen keyboard rather
// than browser chrome showing/hiding (which is usually under ~100px).
const KEYBOARD_MIN_PX = 120;

// Keeps --app-height/--app-offset-top custom properties in sync with the visible viewport.
// Mobile browsers (especially iOS Safari) don't shrink 100dvh when the on-screen keyboard
// opens. Instead they pan the *visual viewport* to reveal the focused input — an offset that
// window.scrollTo cannot undo because the document itself isn't scrollable. So the app shell
// must both shrink to visualViewport.height and translate down by visualViewport.offsetTop
// to sit exactly over the visible area, which lands the chat input on top of the keyboard.
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
