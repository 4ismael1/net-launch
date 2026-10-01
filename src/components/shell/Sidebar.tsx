"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStoredFlag } from "@/lib/hooks/client";
import clsx from "clsx";
import { PanelLeftClose, PanelLeftOpen, MoreHorizontal, X } from "lucide-react";
import { NAV, GROUPS, MOBILE_MAIN } from "./nav";
import { Logo } from "./Logo";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useStoredFlag("net:sidebar");
  // El ancho lo decide <html data-sb> (fijado antes del primer pintado); la animación solo al pulsar.
  const [animate, setAnimate] = useState(false);
  const toggle = () => {
    const v = !collapsed;
    setAnimate(true);
    if (v) document.documentElement.dataset.sb = "c";
    else delete document.documentElement.dataset.sb;
    setCollapsed(v);
  };

  return (
    <aside
      className={clsx(
        "sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-line bg-bg md:flex sb-collapsed:w-[60px]",
        animate && "transition-[width] duration-200 ease-out",
      )}
    >
      <div className="flex h-14 items-center border-b border-line px-4 sb-collapsed:justify-center sb-collapsed:px-0">
        <Link href="/" aria-label="Inicio">
          <Logo textClassName="sb-collapsed:hidden" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <div key={g} className="mb-4">
            <p className="label truncate px-2 pb-1.5 sb-collapsed:hidden">{GROUPS[g]}</p>
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map(({ href, label, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors sb-collapsed:justify-center sb-collapsed:px-0",
                        active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface hover:text-fg",
                      )}
                    >
                      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />}
                      <Icon className={clsx("size-4 shrink-0", active ? "text-accent" : "")} strokeWidth={1.75} />
                      <span className="truncate sb-collapsed:hidden">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        className="flex h-11 items-center gap-2 border-t border-line px-4 text-xs text-fg-dim transition-colors hover:text-fg sb-collapsed:justify-center sb-collapsed:px-0"
        aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        aria-expanded={!collapsed}
      >
        <PanelLeftOpen className="hidden size-4 sb-collapsed:block" />
        <PanelLeftClose className="size-4 sb-collapsed:hidden" />
        <span className="sb-collapsed:hidden">Contraer</span>
      </button>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  // El menú "Más" se cierra solo al navegar: queda abierto únicamente en la ruta donde se abrió.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (v: boolean) => setOpenAt(v ? path : null);
  const main = NAV.filter((n) => MOBILE_MAIN.includes(n.href));
  const rest = NAV.filter((n) => !MOBILE_MAIN.includes(n.href));
  const restActive = rest.some((n) => isActive(path, n.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenAt(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 animate-overlay-in bg-bg/80 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div
            id="mobile-more"
            className="absolute right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 grid max-h-[70dvh] animate-pop-in grid-cols-3 gap-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {rest.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-md px-1 py-3 text-center text-[11px] leading-tight",
                  isActive(path, href) ? "bg-surface-2 text-fg" : "text-fg-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={1.75} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-50 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {main.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={clsx("flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10.5px] transition-colors", active ? "text-fg" : "text-fg-dim")}>
              <Icon className={clsx("size-5", active && "text-accent")} strokeWidth={1.75} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-more"
          className={clsx("flex flex-col items-center justify-center gap-1 text-[10.5px] transition-colors", open || restActive ? "text-fg" : "text-fg-dim")}>
          {open ? <X className="size-5" /> : <MoreHorizontal className={clsx("size-5", restActive && "text-accent")} />}
          Más
        </button>
      </nav>
    </>
  );
}
