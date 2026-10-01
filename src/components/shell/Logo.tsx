/** Marca: órbita + punto de ignición. */
export function Logo({ compact = false, textClassName }: { compact?: boolean; textClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.3" />
        <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="20.2" cy="7.4" r="1.9" fill="var(--color-accent)" />
      </svg>
      {!compact && (
        <span className={`flex flex-col leading-none ${textClassName ?? ""}`}>
          <span className="font-mono text-[15px] font-semibold tracking-[0.18em]">NET</span>
          <span className="mt-1 text-[9.5px] tracking-wide text-fg-dim">Monitor de lanzamientos</span>
        </span>
      )}
    </span>
  );
}
