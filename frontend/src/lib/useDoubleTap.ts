export function useDoubleTap(onDoubleTap: () => void) {
  return {
    onDoubleClick: onDoubleTap,
    style: { touchAction: "manipulation" as const },
  };
}
