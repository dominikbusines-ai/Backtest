import { NextResponse } from "next/server";
import { z } from "zod";
import { resolutionPatternSchema } from "@/lib/mistake-resolutions";
import { readMistakeResolutions, saveMistakeResolution } from "@/lib/mistake-report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const requestSchema = z.object({ pattern: resolutionPatternSchema, resolved: z.boolean() });

export async function GET() {
  try { return NextResponse.json({ resolutions: await readMistakeResolutions() }, { headers }); }
  catch { return NextResponse.json({ error: "Gelöste Probleme konnten nicht geladen werden. Bitte die Seite erneut laden." }, { status: 503, headers }); }
}

export async function PATCH(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültiger Problemstatus." }, { status: 400, headers });
  try { return NextResponse.json({ resolution: await saveMistakeResolution(parsed.data.pattern, parsed.data.resolved) }, { headers }); }
  catch { return NextResponse.json({ error: "Die Markierung konnte nicht gespeichert werden. Bitte erneut versuchen." }, { status: 503, headers }); }
}
