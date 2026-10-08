export default function StreakFlame({ lit, size = 40 }: { lit: boolean; size?: number }) {
  return (
    <span aria-hidden className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {lit && (
        <>
          <span className="streak-flame" />
          <span className="streak-flame streak-flame-core" />
        </>
      )}
      <img
        src="/studily-3a.svg"
        alt=""
        draggable={false}
        className="relative h-full w-full select-none"
        style={
          lit
            ? { filter: "drop-shadow(0 0 5px color-mix(in srgb, var(--orange-vivid) 50%, transparent))" }
            : { filter: "grayscale(1)", opacity: 0.45 }
        }
      />
    </span>
  );
}
