import { useEffect } from "react";

const LIGHT: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [22, 22, 30];

const scrims: number[] = [];

function hex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, "0");
}

export function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const base = document.documentElement.classList.contains("dark") ? DARK : LIGHT;
  const factor = scrims.reduce((acc, alpha) => acc * (1 - alpha), 1);
  meta.setAttribute("content", `#${base.map((c) => hex(c * factor)).join("")}`);
}

export function useModalScrim(alpha = 0.45, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    scrims.push(alpha);
    syncThemeColor();
    return () => {
      scrims.splice(scrims.indexOf(alpha), 1);
      syncThemeColor();
    };
  }, [alpha, enabled]);
}
