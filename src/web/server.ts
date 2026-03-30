import "dotenv/config";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import { loadTrackedProducts } from "../config/products";
import { initializeDatabase } from "../storage/db";
import { PriceRepository } from "../storage/repository";
import { computeTrend } from "../analytics/trend";

const PORT = Number(process.env.DASHBOARD_PORT ?? 3000);
const DB_PATH = process.env.DB_PATH ?? "./price-tracker.db";

interface ApiProduct {
  id: string;
  name: string;
  source: string;
  url: string;
  currency: string;
  trend: {
    initialPrice: number;
    currentPrice: number;
    changeAbsolute: number;
    changePercent: number;
    direction: string;
    sampleSize: number;
  } | null;
  history: { price: number; currency: string; capturedAt: string }[];
}

async function main(): Promise<void> {
  const sqlite = await initializeDatabase(DB_PATH);
  const repository = new PriceRepository(sqlite);

  const server = http.createServer((req, res) => {
    if (req.url === "/api/products") {
      const products = loadTrackedProducts();
      const items = repository.getProductsWithHistory(products);

      const payload: ApiProduct[] = items.map((item) => {
        const trend = computeTrend(item.history);
        return {
          id: item.product.id,
          name: item.product.name,
          source: item.product.source,
          url: item.product.url,
          currency: item.history[0]?.currency ?? item.product.currency ?? "USD",
          trend: trend
            ? {
                initialPrice: trend.initialPrice,
                currentPrice: trend.currentPrice,
                changeAbsolute: trend.changeAbsolute,
                changePercent: trend.changePercent,
                direction: trend.trendDirection,
                sampleSize: trend.sampleSize
              }
            : null,
          history: item.history
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.url === "/" || req.url === "/index.html") {
      const htmlPath = path.join(__dirname, "dashboard.html");
      fs.readFile(htmlPath, "utf-8", (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Failed to load dashboard");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`Dashboard running at http://localhost:${PORT}`);
  });
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
