import type { Stats, Trade } from "@/lib/types";

export function calculateStats(trades: Trade[]): Stats {
  const actualTrades = trades.filter((trade) => trade.result_type !== "no_trade");
  const noTrades = trades.filter((trade) => trade.result_type === "no_trade");
  const wins = actualTrades.filter((trade) => trade.result_type === "win");
  const losses = actualTrades.filter((trade) => trade.result_type === "loss");
  const breakeven = actualTrades.filter((trade) => trade.result_type === "breakeven");
  const measured = actualTrades.filter((trade) => trade.result_r !== null);
  const resultValues = measured.map((trade) => trade.result_r as number);
  const winnerValues = wins.map((trade) => trade.result_r).filter((value): value is number => value !== null);
  const loserValues = losses.map((trade) => trade.result_r).filter((value): value is number => value !== null);
  const planned = actualTrades.map((trade) => trade.planned_rr).filter((value): value is number => value !== null);
  const grossProfit = resultValues.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(resultValues.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const totalR = resultValues.reduce((sum, value) => sum + value, 0);

  return {
    trades: actualTrades.length,
    noTrades: noTrades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winrate: actualTrades.length ? (wins.length / actualTrades.length) * 100 : 0,
    avgR: measured.length ? totalR / measured.length : 0,
    totalR,
    avgWinner: winnerValues.length ? winnerValues.reduce((sum, value) => sum + value, 0) / winnerValues.length : 0,
    avgLoser: loserValues.length ? loserValues.reduce((sum, value) => sum + value, 0) / loserValues.length : 0,
    avgPlannedRr: planned.length ? planned.reduce((sum, value) => sum + value, 0) / planned.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: measured.length ? totalR / measured.length : 0,
  };
}

export function hasEveryTag(trade: Trade, tagIds: string[]) {
  const ids = new Set(trade.tags.map((tag) => tag.id));
  return tagIds.every((id) => ids.has(id));
}
