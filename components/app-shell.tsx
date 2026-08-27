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
      <header className="sticky top-0 z-40 border-b border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="EdgeLog Startseite">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-sm font-black text-ink">E</span>
            <span className="text-sm font-bold tracking-tight">EDGE<span className="text-lime">LOG</span></span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Hauptnavigation">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link key={href} href={href} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 ${active ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-5 py-8 lg:px-8">{children}</main>
    </div>
  );
}
