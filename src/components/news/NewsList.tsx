import { ExternalLink, Newspaper } from "lucide-react";
import type { Article } from "@/lib/news";
import { LocalTime } from "@/components/launch/LocalTime";

export function NewsGrid({ items }: { items: Article[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((a) => (
        <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
          <div className="aspect-[16/9] overflow-hidden bg-surface-3">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" loading="lazy" className="size-full object-cover opacity-85 transition group-hover:opacity-100" />
            ) : <div className="flex size-full items-center justify-center"><Newspaper className="size-6 text-fg-dim" /></div>}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3.5">
            <p className="label !text-fg-muted">{a.site}</p>
            <h3 lang="en" className="line-clamp-3 text-[14.5px] leading-snug font-medium">{a.title}</h3>
            <p lang="en" className="line-clamp-2 text-xs text-fg-dim">{a.summary}</p>
            <p className="mt-auto flex items-center justify-between pt-2 text-[11px] text-fg-dim">
              <LocalTime date={a.publishedAt} mode="relative" />
              <ExternalLink className="size-3.5" />
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}

export function NewsRows({ items }: { items: Article[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id}>
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span lang="en" className="line-clamp-2 text-sm">{a.title}</span>
              <span className="mt-0.5 block text-xs text-fg-dim">{a.site} · <LocalTime date={a.publishedAt} mode="relative" /></span>
            </span>
            <ExternalLink className="mt-1 size-3.5 shrink-0 text-fg-dim" />
          </a>
        </li>
      ))}
    </ul>
  );
}
