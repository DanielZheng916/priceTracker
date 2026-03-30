import { parsePriceFromText } from "../src/utils/price";

describe("parsePriceFromText", () => {
  it("parses standard usd text", () => {
    expect(parsePriceFromText("$59.99")).toBe(59.99);
  });

  it("parses comma-separated numbers", () => {
    expect(parsePriceFromText("Now only $1,249.00")).toBe(1249);
  });

  it("returns null for non-price strings", () => {
    expect(parsePriceFromText("Unavailable")).toBeNull();
  });
});
