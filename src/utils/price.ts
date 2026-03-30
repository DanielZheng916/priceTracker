const PRICE_PATTERN = /([$€£]?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/;

export function parsePriceFromText(value: string): number | null {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(PRICE_PATTERN);
  if (!match) {
    return null;
  }

  const normalized = match[0].replace(/[$€£,\s]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatPrice(price: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export function getValueByPath(data: unknown, path: string): unknown {
  return path
    .split(".")
    .filter(Boolean)
    .reduce<unknown>((acc, key) => {
      if (acc === null || acc === undefined) {
        return undefined;
      }

      if (Array.isArray(acc)) {
        const idx = Number.parseInt(key, 10);
        return Number.isInteger(idx) ? acc[idx] : undefined;
      }

      if (typeof acc === "object") {
        return (acc as Record<string, unknown>)[key];
      }

      return undefined;
    }, data);
}

export function findNumericValueByKey(data: unknown, keys: string[]): number | null {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }

  if (typeof data === "string") {
    return parsePriceFromText(data);
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findNumericValueByKey(item, keys);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      if (keys.includes(key)) {
        const parsed = findNumericValueByKey(value, []);
        if (parsed !== null) {
          return parsed;
        }
      }

      const nested = findNumericValueByKey(value, keys);
      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}
