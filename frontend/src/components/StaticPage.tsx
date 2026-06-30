export default function StaticPage({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl animate-in">
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="mt-2 text-sm text-fg-3">Coming soon.</p>
    </div>
  );
}
