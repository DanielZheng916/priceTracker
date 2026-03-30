import { StoredPricePoint } from "../storage/repository";

export type TrendDirection = "up" | "down" | "flat";

export interface TrendSummary {
  initialPrice: number;
  currentPrice: number;
  changeAbsolute: number;
  changePercent: number;
  trendDirection: TrendDirection;
  sampleSize: number;
}

function resolveDirection(changeAbsolute: number): TrendDirection {
  const epsilon = 0.0001;
  if (Math.abs(changeAbsolute) <= epsilon) {
    return "flat";
  }
  return changeAbsolute > 0 ? "up" : "down";
}

export function computeTrend(history: StoredPricePoint[]): TrendSummary | null {
  if (history.length === 0) {
    return null;
  }

  const initialPrice = history[0].price;
  const currentPrice = history[history.length - 1].price;
  const changeAbsolute = currentPrice - initialPrice;
  const changePercent = initialPrice === 0 ? 0 : (changeAbsolute / initialPrice) * 100;

  return {
    initialPrice,
    currentPrice,
    changeAbsolute,
    changePercent,
    trendDirection: resolveDirection(changeAbsolute),
    sampleSize: history.length
  };
}
