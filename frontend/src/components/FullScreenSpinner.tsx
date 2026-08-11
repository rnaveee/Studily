export default function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <div className="flex items-center gap-2 text-sm text-fg-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
        Loading…
      </div>
    </div>
  );
}
