import { TrackedProduct } from "../sources/types";

const defaultProducts: TrackedProduct[] = [
  {
    id: "ardbeg-uigeadail",
    name: "Ardbeg Uigeadail",
    source: "total-wine",
    url: "https://www.totalwine.com/spirits/scotch/single-malt/ardbeg-uigeadail-single-malt-scotch/p/36672750",
    currency: "USD"
  },
  {
    id: "astro-bot-ps5",
    name: "ASTRO BOT (PS5)",
    source: "playstation",
    url: "https://www.playstation.com/en-us/games/astro-bot/",
    currency: "USD"
  }
];

export function loadTrackedProducts(): TrackedProduct[] {
  const inlineProducts = process.env.TRACKED_PRODUCTS_JSON;
  if (!inlineProducts) {
    return defaultProducts;
  }

  try {
    const parsed = JSON.parse(inlineProducts) as TrackedProduct[];
    return parsed;
  } catch (error) {
    throw new Error(`Invalid TRACKED_PRODUCTS_JSON: ${(error as Error).message}`);
  }
}
