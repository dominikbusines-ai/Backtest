import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { requireSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    instrument: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
    time: { type: ["string", "null"], description: "HH:MM or null" },
    timeframe: { type: ["string", "null"] },
    direction: { type: ["string", "null"], enum: ["long", "short", null] },
    entry: { type: ["number", "null"] },
    stopLoss: { type: ["number", "null"] },
    takeProfit: { type: ["number", "null"] },
    riskReward: { type: ["number", "null"] },
    resultType: { type: ["string", "null"], enum: ["win", "loss", "breakeven", "no_trade", null] },
    resultR: { type: ["number", "null"] },
    detectedObservations: { type: "array", items: { type: "string" } },
    detectedZones: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        instrument: { type: "number", minimum: 0, maximum: 1 },
        date: { type: "number", minimum: 0, maximum: 1 },
        time: { type: "number", minimum: 0, maximum: 1 },
        timeframe: { type: "number", minimum: 0, maximum: 1 },
        direction: { type: "number", minimum: 0, maximum: 1 },
        entry: { type: "number", minimum: 0, maximum: 1 },
        stopLoss: { type: "number", minimum: 0, maximum: 1 },
        takeProfit: { type: "number", minimum: 0, maximum: 1 },
        riskReward: { type: "number", minimum: 0, maximum: 1 },
        resultType: { type: "number", minimum: 0, maximum: 1 },
        resultR: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["instrument", "date", "time", "timeframe", "direction", "entry", "stopLoss", "takeProfit", "riskReward", "resultType", "resultR"],
    },
  },
  required: ["instrument", "date", "time", "timeframe", "direction", "entry", "stopLoss", "takeProfit", "riskReward", "resultType", "resultR", "detectedObservations", "detectedZones", "confidence"],
} as const;

const supportedImageTypes = ["image/png", "image/jpeg", "image/webp"] as const;
type SupportedImageType = (typeof supportedImageTypes)[number];

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY ist noch nicht konfiguriert.");
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Kein Bild übermittelt." }, { status: 400 });
    if (!supportedImageTypes.includes(file.type as SupportedImageType)) return NextResponse.json({ error: "Nur PNG, JPG und WebP werden unterstützt." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Das Bild ist nach der Optimierung größer als 5 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.parse({
      model: process.env.ANTHROPIC_VISION_MODEL || "claude-haiku-4-5",
      max_tokens: 1200,
      system: "Du extrahierst ausschließlich objektiv sichtbare Daten aus Trading-Charts. Erfinde nichts und bewerte weder den Trade noch den Entry.",
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: file.type as SupportedImageType,
              data: buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Extrahiere die sichtbaren Chartdaten. Wenn kein ausgeführter oder eindeutig markierter Trade beziehungsweise Entry sichtbar ist, setze resultType auf no_trade; direction, entry, stopLoss, takeProfit, riskReward und resultR müssen dann null sein und ihre Confidence-Werte 0. Setze jedes andere nicht sicher erkennbare Datenfeld auf null und dessen Confidence-Wert auf 0. Beobachtungen und Zonen nur nennen, wenn sie im Bild ausdrücklich beschriftet oder eindeutig markiert sind. Confidence-Werte müssen zwischen 0 und 1 liegen.",
          },
        ],
      }],
      output_config: { format: jsonSchemaOutputFormat(schema) },
    });
    const analysis = response.parsed_output;
    if (!analysis) throw new Error("Anthropic hat keine auswertbare Antwort geliefert.");

    const supabase = requireSupabase();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("trade-screenshots").upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) throw uploadError;
    const { data: signed } = await supabase.storage.from("trade-screenshots").createSignedUrl(path, 3600);

    return NextResponse.json({ ...analysis, screenshotPath: path, screenshotUrl: signed?.signedUrl ?? "" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Screenshot konnte nicht analysiert werden." }, { status: 500 });
  }
}
