import { NextResponse } from "next/server";
import { deleteTrade, getTrade, updateTrade } from "@/lib/trade-data";
import { tradeInputSchema } from "@/lib/trade-schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const trade = await getTrade((await params).id);
    return trade ? NextResponse.json({ trade }) : NextResponse.json({ error: "Trade nicht gefunden." }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trade konnte nicht geladen werden." }, { status: 503 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const input = tradeInputSchema.parse(await request.json());
    await updateTrade((await params).id, input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trade konnte nicht aktualisiert werden." }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    await deleteTrade((await params).id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Trade konnte nicht gelöscht werden." }, { status: 400 });
  }
}
