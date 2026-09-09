import Link from "next/link";
import { BookOpenText, ChevronDown } from "lucide-react";
import type { Trade } from "@/lib/types";

export function TradeReviews({ trades }: { trades: Trade[] }) {
  return <details className="panel group/reviews">
    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-lime sm:px-5 [&::-webkit-details-marker]:hidden">
      <BookOpenText className="h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-semibold">Eigene Nachbetrachtungen</span>
      <span className="shrink-0 text-xs text-zinc-500">{trades.length}</span>
      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open/reviews:rotate-180" aria-hidden="true" />
    </summary>
    <div className="divide-y divide-line border-t border-line">
      {trades.map((trade) => <details key={trade.id} className="group/review">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-lime sm:px-5 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-200">{trade.instrument} · {trade.result_type === "no_trade" ? "KEIN TRADE" : trade.direction?.toUpperCase() ?? "—"}</p>
            <p className="mt-1 text-xs text-zinc-500">{new Intl.DateTimeFormat("de-DE").format(new Date(`${trade.trade_date}T12:00:00`))}{trade.result_r === null ? "" : ` · ${trade.result_r > 0 ? "+" : ""}${trade.result_r.toFixed(2)}R`}</p>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition group-open/review:rotate-180" aria-hidden="true" />
        </summary>
        <div className="px-4 pb-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {trade.review_observation && <ReviewText label="Aufgefallen" text={trade.review_observation} />}
            {trade.result_type === "no_trade"
              ? trade.review_illogical && <ReviewText label="Unlogisch" text={trade.review_illogical} />
              : <>{trade.review_mistake && <ReviewText label="Missachtet" text={trade.review_mistake} />}{trade.review_invalidation && <ReviewText label="Entry entkräftet durch" text={trade.review_invalidation} />}</>}
          </div>
          <Link href={`/trades/${trade.id}/bearbeiten`} className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-lime hover:text-white">Bearbeiten</Link>
        </div>
      </details>)}
      {!trades.length && <p className="px-4 py-6 text-sm text-zinc-500 sm:px-5">Für diesen Eintragstyp gibt es noch keine eigenen Nachbetrachtungen.</p>}
    </div>
  </details>;
}

function ReviewText({ label, text }: { label: string; text: string }) {
  return <div className="min-w-0"><span className="label">{label}</span><p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-400">{text}</p></div>;
}
