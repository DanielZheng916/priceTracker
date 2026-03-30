import { getAdapter } from "../sources/resolver";
import { TrackedProduct } from "../sources/types";
import { PriceRepository } from "../storage/repository";

interface PollResult {
  productId: string;
  success: boolean;
  message: string;
}

export async function pollOnce(
  products: TrackedProduct[],
  repository: PriceRepository
): Promise<PollResult[]> {
  const results: PollResult[] = [];

  for (const product of products) {
    repository.upsertProduct(product);

    try {
      const adapter = getAdapter(product.source);
      const snapshot = await adapter.fetchPrice(product);
      repository.insertSnapshot(snapshot);
      results.push({
        productId: product.id,
        success: true,
        message: `Captured ${snapshot.currency} ${snapshot.price.toFixed(2)}`
      });
    } catch (error) {
      results.push({
        productId: product.id,
        success: false,
        message: (error as Error).message
      });
    }
  }

  return results;
}

export async function startPolling(
  products: TrackedProduct[],
  repository: PriceRepository,
  intervalHours: number
): Promise<void> {
  const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;

  const runAndLog = async (): Promise<void> => {
    const results = await pollOnce(products, repository);
    const now = new Date().toISOString();
    for (const result of results) {
      const status = result.success ? "ok" : "error";
      console.log(`[${now}] [${status}] ${result.productId}: ${result.message}`);
    }
  };

  await runAndLog();
  setInterval(() => {
    void runAndLog();
  }, intervalMs);
}
