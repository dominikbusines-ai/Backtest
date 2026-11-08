"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { mistakeReturnTarget } from "@/lib/mistake-navigation";

export function EvidenceReturnLink() {
  const params = useSearchParams();
  const target = mistakeReturnTarget(params.get("return_to"));
  if (!target) return null;
  return <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 border-b border-line bg-ink/95 backdrop-blur-xl sm:top-[calc(4rem+env(safe-area-inset-top))]">
    <div className="mx-auto max-w-[1440px] px-4 sm:px-5 lg:px-8">
      <Link href={target} className="flex min-h-11 w-fit items-center gap-2 py-2 text-sm font-semibold text-lime"><ArrowLeft aria-hidden="true" className="h-4 w-4" />{target.startsWith("/fehlermuster") ? "Zurück zu Fehlermustern" : "Zurück zur Fehlerprüfung"}</Link>
    </div>
  </div>;
}
