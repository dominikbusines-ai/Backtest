"use client";
/* eslint-disable @next/next/no-img-element -- Private Screenshots werden über kurzlebige signierte URLs geladen. */

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

export function TradeImageViewer({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <>
    <button type="button" onClick={() => setOpen(true)} className="group relative block min-h-52 w-full cursor-zoom-in overflow-hidden text-left sm:min-h-72" aria-label={`${alt} groß ansehen`}>
      <img src={src} alt={alt} className="min-h-52 w-full object-contain transition duration-200 group-hover:scale-[1.01] sm:min-h-72" />
      <span className="absolute bottom-3 right-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-ink/85 px-3 py-2 text-xs font-semibold text-zinc-200 shadow-lg backdrop-blur-md">
        <Maximize2 className="h-4 w-4" /> Groß ansehen
      </span>
    </button>

    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${alt} – große Ansicht`} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <img src={src} alt={alt} className="max-h-[calc(100dvh-1.5rem)] max-w-full object-contain sm:max-h-[calc(100dvh-3rem)]" />
      <button ref={closeButtonRef} type="button" onClick={() => setOpen(false)} className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-ink/90 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md sm:right-6 sm:top-6" aria-label="Große Bildansicht schließen">
        <X className="h-4 w-4" /> Schließen
      </button>
    </div>}
  </>;
}
