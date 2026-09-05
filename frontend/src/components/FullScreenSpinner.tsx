import { Spinner } from "./Skeleton";

export default function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <Spinner size={16} label="Loading…" />
    </div>
  );
}
