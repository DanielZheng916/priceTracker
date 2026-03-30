import { readFileSync } from "fs";
import { resolve } from "path";
import { TrackedProduct } from "../sources/types";

const CONFIG_PATH = resolve(process.cwd(), "products.json");

export function loadTrackedProducts(): TrackedProduct[] {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const products = JSON.parse(raw) as TrackedProduct[];
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error("products.json must be a non-empty JSON array");
    }
    return products;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Config file not found: ${CONFIG_PATH}`);
    }
    throw new Error(`Failed to load products.json: ${(error as Error).message}`);
  }
}
