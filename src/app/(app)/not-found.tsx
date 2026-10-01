import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader eyebrow="Error 404" title="No encontramos esta página"
        description="El enlace puede estar mal escrito, o el lanzamiento, la base o la organización ya no figura en los datos públicos." />
      <div className="grid-bg flex min-h-[40vh] flex-col items-center justify-center gap-5 rounded-lg border border-line bg-surface px-4 py-12 text-center">
        <p className="num text-5xl text-fg-dim">404</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/panel" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-fg px-3.5 text-sm font-medium text-bg hover:opacity-90">
            Ir al panel <ArrowRight className="size-4" />
          </Link>
          <Link href="/lanzamientos" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3.5 text-sm hover:bg-surface-2">
            Ver lanzamientos
          </Link>
        </div>
      </div>
    </div>
  );
}
