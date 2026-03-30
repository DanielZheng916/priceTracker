import { execSync } from "child_process";
import * as cheerio from "cheerio";
import { existsSync, mkdirSync } from "fs";
import { homedir, platform } from "os";
import { join, resolve } from "path";
import type { Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

import { findNumericValueByKey, parsePriceFromText } from "../utils/price";
import { PriceSnapshot, SourceAdapter, TrackedProduct } from "./types";

puppeteer.use(StealthPlugin());

const NAVIGATION_TIMEOUT_MS = 60_000;
const MAX_CHALLENGE_ATTEMPTS = 3;
const SCRAPER_PROFILE_DIR = resolve(process.cwd(), ".chrome-profile");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms + Math.random() * 500));
}

function findChromePath(): string | undefined {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser"
  ];
  for (const p of candidates) {
    try {
      require("fs").accessSync(p, require("fs").constants.X_OK);
      return p;
    } catch {
      continue;
    }
  }
  return undefined;
}

function getSystemChromeProfile(): string | undefined {
  const candidates = [
    join(homedir(), "Library", "Application Support", "Google", "Chrome"),
    join(homedir(), ".config", "google-chrome"),
    join(homedir(), ".config", "chromium")
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return undefined;
}

async function pressAndHold(page: Page, x: number, y: number, holdMs: number): Promise<void> {
  const offsetX = -30 - Math.random() * 40;
  const offsetY = -20 - Math.random() * 30;
  await page.mouse.move(x + offsetX, y + offsetY, { steps: 8 + Math.floor(Math.random() * 10) });
  await sleep(300);
  await page.mouse.move(x, y, { steps: 12 + Math.floor(Math.random() * 8) });
  await sleep(200);
  await page.mouse.down();
  await sleep(holdMs);
  await page.mouse.up();
}

async function trySolvePxCaptcha(page: Page): Promise<boolean> {
  const pxCaptcha = await page.$("#px-captcha");
  if (pxCaptcha) {
    const box = await pxCaptcha.boundingBox();
    if (box) {
      console.log("[total-wine] Found #px-captcha, pressing and holding...");
      await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2, 10_000 + Math.random() * 3_000);
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 });
      } catch { /* navigation may not fire */ }
      const title = await page.title();
      if (!title.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved.");
        return true;
      }
    }
  }

  const fallbackBtn = await page.evaluateHandle(() => {
    const all = document.querySelectorAll("div, button, span, a");
    for (const el of all) {
      if ((el.textContent || "").trim().toLowerCase() === "press & hold") return el;
    }
    return null;
  });
  if (fallbackBtn && fallbackBtn.asElement()) {
    const box = await fallbackBtn.asElement()!.boundingBox();
    if (box) {
      console.log('[total-wine] Found "Press & Hold" button, pressing...');
      await pressAndHold(page, box.x + box.width / 2, box.y + box.height / 2, 10_000 + Math.random() * 3_000);
      try {
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15_000 });
      } catch { /* no-op */ }
      const title = await page.title();
      if (!title.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved.");
        return true;
      }
    }
  }

  return false;
}

async function solvePxChallenge(page: Page, headless: boolean): Promise<void> {
  const title = await page.title();
  if (!title.toLowerCase().includes("denied")) return;

  console.log("[total-wine] Bot challenge detected. Attempting to solve...");

  for (let attempt = 1; attempt <= MAX_CHALLENGE_ATTEMPTS; attempt++) {
    await sleep(3_000);
    if (await trySolvePxCaptcha(page)) {
      await sleep(2_000);
      return;
    }
    if (attempt < MAX_CHALLENGE_ATTEMPTS) {
      console.log(`[total-wine] Attempt ${attempt}/${MAX_CHALLENGE_ATTEMPTS} failed, retrying...`);
      await sleep(2_000);
    }
  }

  if (!headless) {
    console.log(
      "[total-wine] Could not auto-solve. Please solve the challenge in the browser window. " +
        "Waiting up to 60 seconds..."
    );
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await sleep(2_000);
      const t = await page.title();
      if (!t.toLowerCase().includes("denied")) {
        console.log("[total-wine] Challenge solved by user.");
        await sleep(2_000);
        return;
      }
    }
  }
}

function isChromeRunning(): boolean {
  try {
    if (platform() === "darwin") {
      const result = execSync("pgrep -x 'Google Chrome'", { encoding: "utf-8" });
      return result.trim().length > 0;
    }
    const result = execSync("pgrep -x chrome || pgrep -x chromium", { encoding: "utf-8" });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

async function quitChrome(): Promise<void> {
  if (!isChromeRunning()) return;

  console.log("[total-wine] Chrome is running. Closing it to use system profile...");
  try {
    if (platform() === "darwin") {
      execSync('osascript -e \'quit app "Google Chrome"\'');
    } else {
      execSync("pkill -TERM chrome || pkill -TERM chromium");
    }
  } catch {
    throw new Error(
      "Could not close Chrome automatically. Please close it manually and try again."
    );
  }

  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await sleep(1_000);
    if (!isChromeRunning()) {
      console.log("[total-wine] Chrome closed.");
      return;
    }
  }
  throw new Error("Chrome did not close in time. Please close it manually and try again.");
}

async function resolveUserDataDir(): Promise<string> {
  const useSystem = process.env.CHROME_PROFILE === "system";
  if (useSystem) {
    const systemDir = getSystemChromeProfile();
    if (!systemDir) {
      throw new Error("No system Chrome profile found. Make sure Chrome is installed.");
    }
    await quitChrome();
    console.log(`[total-wine] Using system Chrome profile: ${systemDir}`);
    return systemDir;
  }
  mkdirSync(SCRAPER_PROFILE_DIR, { recursive: true });
  return SCRAPER_PROFILE_DIR;
}

async function fetchRenderedHtml(url: string): Promise<string> {
  const executablePath = findChromePath();
  const headless = process.env.BROWSER_HEADLESS !== "false";
  const userDataDir = await resolveUserDataDir();

  const browser = await puppeteer.launch({
    headless: headless ? ("new" as any) : false,
    ...(executablePath ? { executablePath } : {}),
    userDataDir,
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
