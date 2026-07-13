import { useEffect, useState } from "react";

function measureSafeBottom() {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;left:0;bottom:0;height:env(safe-area-inset-bottom,0px);width:1px;visibility:hidden;pointer-events:none";
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return Math.round(h * 10) / 10;
}

function read() {
  const vv = window.visualViewport;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    innerH: window.innerHeight,
    outerH: window.outerHeight,
    clientH: document.documentElement.clientHeight,
    vvH: vv ? r1(vv.height) : -1,
    vvTop: vv ? r1(vv.offsetTop) : -1,
    vvScale: vv ? r1(vv.scale) : -1,
    screenH: window.screen.height,
    availH: window.screen.availHeight,
    scrollY: r1(window.scrollY),
    appH: document.documentElement.style.getPropertyValue("--app-height") || "unset",
    safeB: measureSafeBottom(),
    standalone: window.matchMedia("(display-mode: standalone)").matches ? "yes" : "no",
    active: document.activeElement?.tagName ?? "none",
  };
}

export default function ViewportDebug() {
  const [vals, setVals] = useState(read);

  useEffect(() => {
    const update = () => setVals(read());
    const id = window.setInterval(update, 500);
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      window.clearInterval(id);
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="fixed left-2 z-[9999] rounded-lg p-2 font-mono text-[11px] leading-[1.5] text-white"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        background: "rgba(0,0,0,0.82)",
        pointerEvents: "none",
      }}
    >
      {Object.entries(vals).map(([k, v]) => (
        <div key={k}>
          {k}: {String(v)}
        </div>
      ))}
    </div>
  );
}
