export function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "positive" | "negative" }) {
  return <div className="panel p-5"><span className="label">{label}</span><p className={`text-2xl font-bold tabular-nums ${tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-rose-400" : "text-zinc-100"}`}>{value}</p></div>;
}
