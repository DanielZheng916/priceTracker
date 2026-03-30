import { computeTrend } from "../src/analytics/trend";

describe("computeTrend", () => {
  it("returns null for empty history", () => {
    expect(computeTrend([])).toBeNull();
  });

  it("computes up trend", () => {
    const trend = computeTrend([
      { price: 10, currency: "USD", capturedAt: "2026-01-01T00:00:00.000Z" },
      { price: 15, currency: "USD", capturedAt: "2026-01-02T00:00:00.000Z" }
    ]);

    expect(trend).toEqual({
      initialPrice: 10,
      currentPrice: 15,
      changeAbsolute: 5,
      changePercent: 50,
      trendDirection: "up",
      sampleSize: 2
    });
  });

  it("computes flat trend", () => {
    const trend = computeTrend([
      { price: 10, currency: "USD", capturedAt: "2026-01-01T00:00:00.000Z" },
      { price: 10, currency: "USD", capturedAt: "2026-01-02T00:00:00.000Z" }
    ]);

    expect(trend?.trendDirection).toBe("flat");
    expect(trend?.changePercent).toBe(0);
  });
});
