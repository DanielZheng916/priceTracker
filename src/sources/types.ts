export type SourceType = "total-wine" | "playstation";

export interface TrackedProduct {
  id: string;
  name: string;
  source: SourceType;
  url: string;
  currency?: string;
  apiEndpoint?: string;
  apiPricePath?: string;
}

export interface PriceSnapshot {
  productId: string;
  price: number;
  currency: string;
  capturedAt: string;
  rawPriceText?: string;
}

export interface SourceAdapter {
  source: SourceType;
  fetchPrice(product: TrackedProduct): Promise<PriceSnapshot>;
}
