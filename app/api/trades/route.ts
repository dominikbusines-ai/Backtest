import { NextResponse } from "next/server";
import { createTrade, listTrades } from "@/lib/trade-data";
import { tradeInputSchema } from "@/lib/trade-schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ trades: await listTrades() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trades konnten nicht geladen werden." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const input = tradeInputSchema.parse(await request.json());
    const id = await createTrade(input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trade konnte nicht gespeichert werden." }, { status: 400 });
  }
}
