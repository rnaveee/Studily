import { useEffect, useRef } from "react";

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};
type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};

function requestFullscreen(el: FullscreenEl) {
  const fn = el.requestFullscreen ?? el.webkitRequestFullscreen;
  return fn?.call(el);
}

function exitFullscreen() {
  const doc = document as FullscreenDoc;
  const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  return fn?.call(doc);
}

function isFullscreenActive() {
  const doc = document as FullscreenDoc;
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export function useFullscreen(target: HTMLElement | null, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (target) requestFullscreen(target)?.catch(() => {});
  }, [target]);

  useEffect(() => {
    function onFullscreenChange() {
      if (!isFullscreenActive()) close.current();
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.body.style.overflow = prevOverflow;
      if (isFullscreenActive()) exitFullscreen()?.catch(() => {});
    };
  }, []);
}
