import axios from "axios";
import * as cheerio from "cheerio";

import { parsePriceFromText } from "../utils/price";
import { PriceSnapshot, SourceAdapter, TrackedProduct } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

/**
 * Extract price from JSON-LD Product schema blocks.
 * Targets the standard schema.org offers.price path first,
 * then falls back to searching for known keys.
 */
function extractFromJsonLd($: cheerio.CheerioAPI): { price: number | null; currency?: string } {
  const scripts = $('script[type="application/ld+json"]');
  for (const script of scripts.toArray()) {
    const raw = $(script).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed["@type"] !== "Product") continue;

      const offers = parsed.offers;
      if (!offers) continue;

      // Single offer
      if (offers.price !== undefined) {
        const p = typeof offers.price === "number" ? offers.price : Number(offers.price);
        if (Number.isFinite(p)) {
          return { price: p, currency: offers.priceCurrency };
        }
      }

      // AggregateOffer
      if (offers.lowPrice !== undefined) {
        const p = typeof offers.lowPrice === "number" ? offers.lowPrice : Number(offers.lowPrice);
        if (Number.isFinite(p)) {
          return { price: p, currency: offers.priceCurrency };
        }
      }
    } catch {
      continue;
    }
  }
  return { price: null };
}

function extractFromSelectors($: cheerio.CheerioAPI): { price: number | null; rawText?: string } {
  const selectors = [
    '[data-qa*="finalPrice"]',
    '[data-qa*="display-price"]',
    '[data-qa*="fullPrice"]',
    '[class*="psw-t-title-m"]',
    '[class*="price"]',
    '[id*="price"]'
  ];

  for (const selector of selectors) {
    const nodes = $(selector);
    for (const node of nodes.toArray()) {
      const text = $(node).text().trim();
      const parsed = parsePriceFromText(text);
      if (parsed !== null) {
        return { price: parsed, rawText: text };
      }
    }
  }

  return { price: null };
}

export const playStationAdapter: SourceAdapter = {
  source: "playstation",
  async fetchPrice(product: TrackedProduct): Promise<PriceSnapshot> {
    const response = await axios.get(product.url, {
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    const $ = cheerio.load(response.data);

    const jsonLd = extractFromJsonLd($);
    if (jsonLd.price !== null) {
      return {
        productId: product.id,
        price: jsonLd.price,
        currency: jsonLd.currency ?? product.currency ?? "USD",
        capturedAt: new Date().toISOString()
      };
    }

    const selectorPrice = extractFromSelectors($);
    if (selectorPrice.price === null) {
      throw new Error(`Unable to extract price from PlayStation page for ${product.name}`);
    }

    return {
      productId: product.id,
      price: selectorPrice.price,
      currency: product.currency ?? "USD",
      capturedAt: new Date().toISOString(),
      rawPriceText: selectorPrice.rawText
    };
  }
};
