import { NextResponse } from "next/server";
import OpenAI from "openai";
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
    resultType: { type: ["string", "null"], enum: ["win", "loss", "breakeven", null] },
    resultR: { type: ["number", "null"] },
    detectedObservations: { type: "array", items: { type: "string" } },
    detectedZones: { type: "array", items: { type: "string" } },
    confidence: {
      type: "object",
      additionalProperties: false,
      properties: {
        instrument: { type: ["number", "null"], minimum: 0, maximum: 1 },
        date: { type: ["number", "null"], minimum: 0, maximum: 1 },
        time: { type: ["number", "null"], minimum: 0, maximum: 1 },
        timeframe: { type: ["number", "null"], minimum: 0, maximum: 1 },
        direction: { type: ["number", "null"], minimum: 0, maximum: 1 },
        entry: { type: ["number", "null"], minimum: 0, maximum: 1 },
        stopLoss: { type: ["number", "null"], minimum: 0, maximum: 1 },
        takeProfit: { type: ["number", "null"], minimum: 0, maximum: 1 },
        riskReward: { type: ["number", "null"], minimum: 0, maximum: 1 },
        resultType: { type: ["number", "null"], minimum: 0, maximum: 1 },
        resultR: { type: ["number", "null"], minimum: 0, maximum: 1 },
      },
      required: ["instrument", "date", "time", "timeframe", "direction", "entry", "stopLoss", "takeProfit", "riskReward", "resultType", "resultR"],
    },
  },
  required: ["instrument", "date", "time", "timeframe", "direction", "entry", "stopLoss", "takeProfit", "riskReward", "resultType", "resultR", "detectedObservations", "detectedZones", "confidence"],
};

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ist noch nicht konfiguriert.");
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "Kein Bild übermittelt." }, { status: 400 });
    if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type))) return NextResponse.json({ error: "Nur PNG, JPG und WebP werden unterstützt." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Das Bild ist nach der Optimierung größer als 5 MB." }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Extrahiere ausschließlich objektiv sichtbare Daten aus diesem Trading-Chart. Erfinde nichts. Setze jedes nicht sicher erkennbare Feld auf null. Bewerte weder Trade noch Entry. Beobachtungen und Zonen nur nennen, wenn sie im Bild ausdrücklich beschriftet oder eindeutig markiert sind. Confidence enthält nur erkannte Felder und Werte zwischen 0 und 1." },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ],
      }],
      text: { format: { type: "json_schema", name: "trade_chart_extraction", strict: true, schema } },
    });
    const analysis = JSON.parse(response.output_text);

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
