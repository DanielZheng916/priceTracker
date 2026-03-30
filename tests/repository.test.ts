import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { initializeDatabase } from "../src/storage/db";
import { PriceRepository } from "../src/storage/repository";
import { TrackedProduct } from "../src/sources/types";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("PriceRepository", () => {
  it("stores and retrieves price history", async () => {
    const dir = mkdtempSync(join(tmpdir(), "price-tracker-test-"));
    tempDirs.push(dir);
    const dbPath = join(dir, "test.db");
    const sqlite = await initializeDatabase(dbPath);
    const repository = new PriceRepository(sqlite);

    const product: TrackedProduct = {
      id: "test-product",
      name: "Test Product",
      source: "total-wine",
      url: "https://example.com/product"
    };

    repository.upsertProduct(product);
    repository.insertSnapshot({
      productId: product.id,
      price: 10,
      currency: "USD",
      capturedAt: "2026-01-01T00:00:00.000Z"
    });
    repository.insertSnapshot({
      productId: product.id,
      price: 12,
      currency: "USD",
      capturedAt: "2026-01-02T00:00:00.000Z"
    });

    const history = repository.getPriceHistory(product.id);
    expect(history).toHaveLength(2);
    expect(history[0].price).toBe(10);
    expect(history[1].price).toBe(12);
    sqlite.close();
  });
});
