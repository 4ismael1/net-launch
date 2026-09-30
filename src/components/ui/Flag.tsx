import { alpha2, countryName } from "@/lib/format";

/** Bandera SVG (flagcdn, gratuito). No muestra nada si no se conoce el país. */
export function Flag({ code, className = "" }: { code: string | null | undefined; className?: string }) {
  const a2 = alpha2(code);
  if (!a2) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${a2}.svg`}
      alt={countryName(code) ?? ""}
      title={countryName(code) ?? ""}
      loading="lazy"
      className={`inline-block h-[0.8em] w-auto rounded-[1px] align-[-0.05em] ${className}`}
    />
  );
}
