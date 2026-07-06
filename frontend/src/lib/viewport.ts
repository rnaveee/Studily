import { useEffect } from "react";

// Keeps a --app-height custom property in sync with the visible viewport. Mobile browsers
// (especially iOS Safari) don't shrink 100dvh when the on-screen keyboard opens — instead they
// pan the visual viewport, which makes a fixed-height app shell appear to scroll the whole
// screen with the focused input stranded mid-page. Tracking window.visualViewport lets the
// shell shrink to what's actually visible, so the keyboard just docks below it like a native app.
export function useVisualViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    function update() {
      const height = vv ? vv.height : window.innerHeight;
      root.style.setProperty("--app-height", `${height}px`);
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
    };
  }, []);
}
