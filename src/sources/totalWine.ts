import * as cheerio from "cheerio";
import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { findNumericValueByKey, parsePriceFromText } from "../utils/price";
import { PriceSnapshot, SourceAdapter, TrackedProduct } from "./types";

puppeteer.use(StealthPlugin());

const NAVIGATION_TIMEOUT_MS = 60_000;

function findChromePath(): string | undefined {
  const fs = require("fs");
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser"
  ];
  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.X_OK);
      return p;
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * Simulate a human-like mouse press-and-hold on an element.
 * Moves the mouse gradually, then holds for the required duration.
 */
async function pressAndHold(page: Page, x: number, y: number, holdMs: number): Promise<void> {
  // Move to a random nearby point first, then glide into the target.
  await page.mouse.move(x - 50, y - 30, { steps: 10 });
  await new Promise((r) => setTimeout(r, 200));
  await page.mouse.move(x, y, { steps: 15 });
  await new Promise((r) => setTimeout(r, 300));
  await page.mouse.down();
  await new Promise((r) => setTimeout(r, holdMs));
  await page.mouse.up();
}

/**
 * Detect and attempt to solve the PerimeterX "Press & Hold" challenge.
 * If running in non-headless mode, falls back to waiting for the user
 * to manually solve the challenge.
 */
async function solvePxChallenge(page: Page, headless: boolean): Promise<void> {
  const title = await page.title();
  if (!title.toLowerCase().includes("denied")) {
    return;
  }

  console.log("[total-wine] Bot challenge detected. Attempting to solve...");

  // Wait for challenge JS to render its UI.
  await new Promise((r) => setTimeout(r, 3_000));

  // The PX captcha renders a #px-captcha element containing the hold target.
  const pxCaptcha = await page.$("#px-captcha");
  if (pxCaptcha) {
    const box = await pxCaptcha.boundingBox();
    if (box) {
      console.log("[total-wine] Found #px-captcha, pressing and holding...");
      await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2, 10_000);
      // Wait for the page to redirect after solving.
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 });
      } catch {
        // Navigation may not fire; check title instead.
      }
      const newTitle = await page.title();
      if (!newTitle.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved.");
        await new Promise((r) => setTimeout(r, 2_000));
        return;
      }
    }
  }

  // Fallback: search all elements for a "Press & Hold" button.
  const fallbackBtn = await page.evaluateHandle(() => {
    const all = document.querySelectorAll("div, button, span, a");
    for (const el of all) {
      const text = (el.textContent || "").trim().toLowerCase();
      if (text === "press & hold") return el;
    }
    return null;
  });

  if (fallbackBtn && fallbackBtn.asElement()) {
    const box = await fallbackBtn.asElement()!.boundingBox();
    if (box) {
      console.log('[total-wine] Found "Press & Hold" button, pressing...');
      await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2, 10_000);
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 });
      } catch {
        // no-op
      }
      const newTitle = await page.title();
      if (!newTitle.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved.");
        await new Promise((r) => setTimeout(r, 2_000));
        return;
      }
    }
  }

  // If non-headless, give the user time to solve manually.
  if (!headless) {
    console.log(
      "[total-wine] Could not auto-solve. Please solve the challenge in the browser window. " +
        "Waiting up to 60 seconds..."
    );
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      const t = await page.title();
      if (!t.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved by user.");
        await new Promise((r) => setTimeout(r, 2_000));
        return;
      }
    }
  }
}

async function fetchRenderedHtml(url: string): Promise<string> {
  const executablePath = findChromePath();
  const headless = process.env.BROWSER_HEADLESS !== "false";

  const browser = await puppeteer.launch({
    headless: headless ? ("new" as any) : false,
    ...(executablePath ? { executablePath } : {}),
    ignoreDefaultArgs: ["--enable-automation"],
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080"
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Remove navigator.webdriver flag that PerimeterX checks.
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: NAVIGATION_TIMEOUT_MS });
    await solvePxChallenge(page, headless);

    return await page.content();
  } finally {
    await browser.close();
  }
}

function extractFromJsonLd($: cheerio.CheerioAPI): number | null {
  const scripts = $('script[type="application/ld+json"]');
  for (const script of scripts.toArray()) {
    const raw = $(script).html();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const numeric = findNumericValueByKey(parsed, ["price", "lowPrice", "highPrice"]);
      if (numeric !== null) return numeric;
    } catch {
      continue;
    }
  }
  return null;
}

function extractFromSelectors($: cheerio.CheerioAPI): { price: number | null; rawText?: string } {
  const selectors = [
    '[data-at="price"]',
    '[itemprop="price"]',
    '[data-testid*="price"]',
    '[class*="price"]',
    '[id*="price"]'
  ];

  for (const selector of selectors) {
    const candidates = $(selector);
    for (const node of candidates.toArray()) {
      const text = $(node).text().trim() || $(node).attr("content") || "";
      const parsed = parsePriceFromText(text);
      if (parsed !== null) {
        return { price: parsed, rawText: text };
      }
    }
  }

  return { price: null };
}

export const totalWineAdapter: SourceAdapter = {
  source: "total-wine",
  async fetchPrice(product: TrackedProduct): Promise<PriceSnapshot> {
    const html = await fetchRenderedHtml(product.url);
    const $ = cheerio.load(html);

    const title = $("title").text();
    if (title.toLowerCase().includes("denied") || title.toLowerCase().includes("captcha")) {
      throw new Error(
        `Total Wine blocked the request (bot detection). ` +
          `Try: BROWSER_HEADLESS=false npm run run-once`
      );
    }

    const fromJsonLd = extractFromJsonLd($);
    if (fromJsonLd !== null) {
      return {
        productId: product.id,
        price: fromJsonLd,
        currency: product.currency ?? "USD",
        capturedAt: new Date().toISOString()
      };
    }

    const fromSelectors = extractFromSelectors($);
    if (fromSelectors.price === null) {
      throw new Error(`Unable to extract price from Total Wine page for ${product.name}`);
    }

    return {
      productId: product.id,
      price: fromSelectors.price,
      currency: product.currency ?? "USD",
      capturedAt: new Date().toISOString(),
      rawPriceText: fromSelectors.rawText
    };
  }
};
