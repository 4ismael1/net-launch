"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useStoredFlag } from "@/lib/hooks/client";
import clsx from "clsx";
import { PanelLeftClose, PanelLeftOpen, MoreHorizontal, X } from "lucide-react";
import { NAV, GROUPS, MOBILE_MAIN } from "./nav";
import { Logo } from "./Logo";

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useStoredFlag("net:sidebar");
  const toggle = () => setCollapsed(!collapsed);

  return (
    <aside
      className={clsx(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg transition-[width] duration-200 md:flex",
        collapsed ? "w-[60px]" : "w-[232px]",
      )}
    >
      <div className={clsx("flex h-14 items-center border-b border-line", collapsed ? "justify-center" : "px-4")}>
        <Link href="/" aria-label="Inicio">
          <Logo compact={collapsed} />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
          <div key={g} className="mb-4">
            {!collapsed && <p className="label px-2 pb-1.5">{GROUPS[g]}</p>}
            <ul className="space-y-0.5">
              {NAV.filter((n) => n.group === g).map(({ href, label, icon: Icon }) => {
                const active = isActive(path, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      title={collapsed ? label : undefined}
                      className={clsx(
                        "group relative flex h-8 items-center gap-2.5 rounded-md text-[13px] transition-colors",
                        collapsed ? "justify-center" : "px-2",
                        active ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface hover:text-fg",
                      )}
                    >
                      {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-accent" />}
                      <Icon className={clsx("size-4 shrink-0", active ? "text-accent" : "")} strokeWidth={1.75} />
                      {!collapsed && label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <button
        onClick={toggle}
        className="flex h-11 items-center gap-2 border-t border-line px-4 text-xs text-fg-dim hover:text-fg"
        aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
      >
        {collapsed ? <PanelLeftOpen className="mx-auto size-4" /> : <><PanelLeftClose className="size-4" /> Contraer</>}
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

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-bg/80 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)}>
          <div
            className="absolute right-3 bottom-[76px] left-3 grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {rest.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-md px-1 py-3 text-[11px]",
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
      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {main.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} className={clsx("flex flex-col items-center justify-center gap-1 text-[10.5px]", active ? "text-fg" : "text-fg-dim")}>
              <Icon className={clsx("size-5", active && "text-accent")} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
        <button onClick={() => setOpen(!open)} className="flex flex-col items-center justify-center gap-1 text-[10.5px] text-fg-dim">
          {open ? <X className="size-5" /> : <MoreHorizontal className="size-5" />}
          Más
        </button>
      </nav>
    </>
  );
}
