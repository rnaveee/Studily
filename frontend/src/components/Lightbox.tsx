import { useEffect, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const stop = (e: SyntheticEvent) => e.stopPropagation();

export default function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center animate-in"
      style={{ background: "rgba(0,0,0,0.88)" }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onDoubleClick={stop}
      onPointerDown={stop}
    >
      <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-3 rounded-full p-2 text-white transition-colors hover:bg-white/15"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>,
    document.body,
  );
}
