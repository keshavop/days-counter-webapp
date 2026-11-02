"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconCalc, IconCalendar, IconCloud, IconPlus } from "./Icons";
import { SyncPill } from "./SyncPill";

const NAV = [
  { href: "/", label: "Events", Icon: IconCalendar },
  { href: "/calculator", label: "Calculator", Icon: IconCalc },
  { href: "/sync", label: "Sync & data", Icon: IconCloud },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/event") : path.startsWith(href);
}

/** Sidebar on desktop, bottom tab bar on mobile. Full-screen editor pages hide the tab bar. */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const focused = path.startsWith("/new") || path.startsWith("/edit");

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-card p-5 md:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent font-display text-lg font-bold text-white">D</span>
          <span className="font-display text-xl font-bold tracking-tight">Days Counter</span>
        </Link>
        <Link
          href="/new"
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-white hover:bg-accent-hover"
        >
          <IconPlus size={18} strokeWidth={2.4} /> New event
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium ${
                  active ? "bg-accent-soft text-accent-soft-ink" : "text-muted hover:bg-seg hover:text-ink"
                }`}
              >
                <Icon size={20} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <SyncPill />
        </div>
      </aside>

      <main className={`min-w-0 flex-1 ${focused ? "" : "pb-24 md:pb-0"}`}>{children}</main>

      {!focused && (
        <nav aria-label="Primary" className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card/95 px-2 pt-2 backdrop-blur md:hidden">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-1.5 text-xs ${active ? "font-semibold text-accent-text" : "font-medium text-muted"}`}
              >
                <Icon size={22} />
                {label === "Sync & data" ? "Sync" : label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
