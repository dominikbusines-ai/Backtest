"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardPlus, Settings, Table2 } from "lucide-react";

const nav = [
  { href: "/", label: "Backtest", icon: ClipboardPlus },
  { href: "/trades", label: "Trades", icon: Table2 },
  { href: "/analyse", label: "Analyse", icon: BarChart3 },
  { href: "/einstellungen", label: "Einstellungen", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:h-16 sm:px-5 lg:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-3" aria-label="EdgeLog Startseite">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-sm font-black text-ink">E</span>
            <span className="text-sm font-bold tracking-tight">EDGE<span className="text-lime">LOG</span></span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Hauptnavigation">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition ${active ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="app-main mx-auto max-w-[1440px] px-4 py-6 sm:px-5 sm:py-8 lg:px-8">{children}</main>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink/95 px-2 pt-1.5 backdrop-blur-xl sm:hidden" aria-label="Mobile Hauptnavigation">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${active ? "bg-lime/10 text-lime" : "text-zinc-500"}`}><Icon className="h-5 w-5" /><span>{label}</span></Link>;
          })}
        </div>
      </nav>
    </div>
  );
}
