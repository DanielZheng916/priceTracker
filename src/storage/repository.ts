import { PriceSnapshot, TrackedProduct } from "../sources/types";
import { SqliteHandle } from "./db";

export interface StoredPricePoint {
  price: number;
  currency: string;
  capturedAt: string;
}

export interface ProductWithHistory {
  product: TrackedProduct;
  history: StoredPricePoint[];
}

export class PriceRepository {
  constructor(private readonly sqlite: SqliteHandle) {}

  upsertProduct(product: TrackedProduct): void {
    const now = new Date().toISOString();
    this.sqlite.db.run(
      `
      INSERT INTO products (id, name, source, url, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        source = excluded.source,
        url = excluded.url
    `,
      [product.id, product.name, product.source, product.url, now]
    );
    this.sqlite.persist();
  }

  insertSnapshot(snapshot: PriceSnapshot): void {
    this.sqlite.db.run(
      `
      INSERT INTO price_history (product_id, price, currency, captured_at, raw_price_text)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        snapshot.productId,
        snapshot.price,
        snapshot.currency,
        snapshot.capturedAt,
        snapshot.rawPriceText ?? null
      ]
    );
    this.sqlite.persist();
  }

  getPriceHistory(productId: string): StoredPricePoint[] {
    const rows = this.sqlite.db.exec(
      `
      SELECT price, currency, captured_at
      FROM price_history
      WHERE product_id = ?
      ORDER BY datetime(captured_at) ASC
    `,
      [productId]
    );

    if (rows.length === 0) {
      return [];
    }

    const [result] = rows;
    const priceIdx = result.columns.indexOf("price");
    const currencyIdx = result.columns.indexOf("currency");
    const capturedIdx = result.columns.indexOf("captured_at");

    return result.values.map((valueRow) => ({
      price: Number(valueRow[priceIdx]),
      currency: String(valueRow[currencyIdx]),
      capturedAt: String(valueRow[capturedIdx])
    }));
  }

  getProductsWithHistory(products: TrackedProduct[]): ProductWithHistory[] {
    return products.map((product) => ({
      product,
      history: this.getPriceHistory(product.id)
    }));
  }
}
