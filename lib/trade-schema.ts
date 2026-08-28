import { z } from "zod";

const nullableNumber = z.number().finite().nullable();

export const tradeInputSchema = z.object({
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trade_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  instrument: z.string().trim().min(1).max(30),
  timeframe: z.string().trim().max(20).nullable(),
  direction: z.enum(["long", "short"]),
  entry: nullableNumber,
  stop_loss: nullableNumber,
  take_profit: nullableNumber,
  planned_rr: nullableNumber,
  result_r: nullableNumber,
  result_type: z.enum(["win", "loss", "breakeven"]),
  confidence: z.number().int().min(1).max(5).nullable(),
  context: z.string().max(5000).nullable(),
  entry_note: z.string().max(2000).nullable(),
  review_observation: z.string().max(5000).nullable(),
  review_mistake: z.string().max(5000).nullable(),
  review_invalidation: z.string().max(5000).nullable(),
  screenshot_url: z.string().max(1000).nullable(),
  mfe: nullableNumber,
  mae: nullableNumber,
  tag_ids: z.array(z.string().uuid()).max(100),
});
