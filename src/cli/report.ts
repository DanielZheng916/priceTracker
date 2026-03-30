import { computeTrend } from "../analytics/trend";
import { TrackedProduct } from "../sources/types";
import { PriceRepository } from "../storage/repository";
import { formatPrice } from "../utils/price";

export function buildReport(products: TrackedProduct[], repository: PriceRepository): string {
  const lines: string[] = [];
  lines.push("Price Tracker Report");
  lines.push("====================");
  lines.push("");

  const items = repository.getProductsWithHistory(products);
  if (items.length === 0) {
    return `${lines.join("\n")}\nNo products configured.`;
  }

  for (const item of items) {
    lines.push(`${item.product.name} (${item.product.source})`);
    lines.push(`URL: ${item.product.url}`);

    const trend = computeTrend(item.history);
    if (!trend) {
      lines.push("Initial: n/a");
      lines.push("Current: n/a");
      lines.push("Trend: n/a");
      lines.push("");
      continue;
    }

    const currency = item.history[0]?.currency ?? item.product.currency ?? "USD";
    const directionSymbol =
      trend.trendDirection === "up" ? "UP" : trend.trendDirection === "down" ? "DOWN" : "FLAT";
    const deltaSign = trend.changeAbsolute > 0 ? "+" : "";

    lines.push(`Initial: ${formatPrice(trend.initialPrice, currency)}`);
    lines.push(`Current: ${formatPrice(trend.currentPrice, currency)}`);
    lines.push(
      `Trend: ${directionSymbol} (${deltaSign}${formatPrice(trend.changeAbsolute, currency)}, ${deltaSign}${trend.changePercent.toFixed(2)}%)`
    );
    lines.push(`Samples: ${trend.sampleSize}`);
    lines.push("");
  }

  return lines.join("\n");
}
