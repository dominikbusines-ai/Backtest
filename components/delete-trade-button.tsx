"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export function DeleteTradeButton({ id }: { id: string }) {
  const router = useRouter(); const [loading, setLoading] = useState(false);
  async function remove() {
    if (!window.confirm("Diesen Trade endgültig löschen?")) return;
    setLoading(true); const response = await fetch(`/api/trades/${id}`, { method: "DELETE" });
    if (response.ok) { router.push("/trades"); router.refresh(); } else { const data = await response.json(); alert(data.error || "Trade konnte nicht gelöscht werden."); setLoading(false); }
  }
  return <button onClick={() => void remove()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/5">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Löschen</button>;
}
