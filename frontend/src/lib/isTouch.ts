export const isTouch =
  typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
