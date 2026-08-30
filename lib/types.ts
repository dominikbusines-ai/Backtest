export type Direction = "long" | "short";
export type ResultType = "win" | "loss" | "breakeven" | "no_trade";

export type TagCategory = {
  id: string;
  name: string;
  sort_order: number;
};

export type Tag = {
  id: string;
  name: string;
  category_id: string | null;
  category?: TagCategory | null;
  is_default: boolean;
};

export type Trade = {
  id: string;
  created_at: string;
  trade_date: string;
  trade_time: string | null;
  instrument: string;
  timeframe: string | null;
  direction: Direction | null;
  entry: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  planned_rr: number | null;
  result_r: number | null;
  result_type: ResultType;
  confidence: number | null;
  context: string | null;
  entry_note: string | null;
  review_observation: string | null;
  review_mistake: string | null;
  review_invalidation: string | null;
  review_illogical: string | null;
  screenshot_url: string | null;
  screenshot_signed_url?: string | null;
  mfe: number | null;
  mae: number | null;
  tags: Tag[];
};

export type TradeInput = Omit<Trade, "id" | "created_at" | "tags" | "screenshot_signed_url"> & {
  tag_ids: string[];
};

export type AnalysisResult = {
  instrument: string | null;
  date: string | null;
  time: string | null;
  timeframe: string | null;
  direction: Direction | null;
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  riskReward: number | null;
  resultType: ResultType | null;
  resultR: number | null;
  detectedObservations: string[];
  detectedZones: string[];
  confidence: Record<string, number>;
  screenshotPath: string;
  screenshotUrl: string;
};

export type Stats = {
  trades: number;
  noTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  winrate: number;
  avgR: number;
  totalR: number;
  avgWinner: number;
  avgLoser: number;
  avgPlannedRr: number;
  profitFactor: number | null;
  expectancy: number;
};
