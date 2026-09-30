import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/shell/Logo";
import { getNextLaunch } from "@/lib/data/launches";
import { Countdown } from "@/components/launch/Countdown";

// Portada provisional. La landing 3D con scroll llega en la F10.
export default async function Landing() {
  const next = await getNextLaunch();
  return (
    <main className="grid-bg relative flex min-h-dvh flex-col items-center justify-center gap-10 px-4 text-center">
      <Logo />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
          Toda la actividad mundial de lanzamientos espaciales, en un solo lugar.
        </h1>
        <p className="mt-4 text-fg-muted">
          Próximos lanzamientos, bases de todo el planeta, organizaciones grandes y pequeñas, histórico y estadísticas, con datos públicos y verificables.
        </p>
      </div>
      {next && (
        <div className="flex flex-col items-center gap-3">
          <p className="label !text-accent">Próximo · {next.name}</p>
          <Countdown net={next.net} precision={next.netPrecision} />
        </div>
      )}
      <Link href="/panel" className="inline-flex h-11 items-center gap-2 rounded-md bg-fg px-5 font-medium text-bg hover:opacity-90">
        Entrar a la plataforma <ArrowRight className="size-4" />
      </Link>
    </main>
  );
}
