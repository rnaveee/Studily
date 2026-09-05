import { revealClass, useReveal } from "../../lib/useReveal";

export default function Reveal({
  children,
  delay = 0,
  variant = "fade",
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: "fade" | "scale";
  className?: string;
}) {
  const { ref, inView } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`${revealClass(inView, variant)} ${className}`.trim()}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
