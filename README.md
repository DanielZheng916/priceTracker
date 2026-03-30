# Price Tracker App

Track product price history from Total Wine and PlayStation, then report:

- Initial price
- Current price
- Price trend (up/down/flat)

## What This App Does

- Node.js + TypeScript price tracker
- SQLite storage for historical snapshots
- One-off polling and scheduled polling
- CLI report with absolute and percent change
- Dashboard UI with interactive charts

## Supported Sources

- `total-wine`: Puppeteer + stealth plugin (PerimeterX-aware scraping)
- `playstation`: direct HTTP + JSON-LD extraction

## Quick Start

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Optionally copy environment defaults:

```bash
cp .env.example .env
```

3. Capture one snapshot:

```bash
BROWSER_HEADLESS=false npm run run-once
```

4. Print report:

```bash
npm run report
```

5. Start scheduler (runs once immediately, then every `POLL_INTERVAL_HOURS`):

```bash
BROWSER_HEADLESS=false npm run poll
```

## Commands

- `npm run run-once`: poll one time and exit
- `npm run poll`: poll immediately, then continue on interval
- `npm run report`: print initial/current/trend data
- `npm run dashboard`: run web UI at `http://localhost:3000`
- `npm run test`: run unit tests

## Configuration

### Environment Variables

- `DB_PATH`: SQLite file path (default: `./price-tracker.db`)
- `POLL_INTERVAL_HOURS`: poll interval in hours (default: `6`)
- `BROWSER_HEADLESS`: set `false` for Total Wine reliability (default: `true`)
- `CHROME_PROFILE`: set `system` to use your local Chrome profile (Chrome must be closed); otherwise uses `.chrome-profile/`

### Tracked Products

Edit root-level `products.json` to add, remove, or update tracked products:

```json
[
  {
    "id": "astro-bot-ps5",
    "name": "ASTRO BOT (PS5)",
    "source": "playstation",
    "url": "https://www.playstation.com/en-us/games/astro-bot/",
    "currency": "USD"
  }
]
```

`source` must be one of:

- `total-wine`
- `playstation`

## Total Wine Bot Protection

Total Wine uses PerimeterX protection. This app mitigates it by:

1. Using `puppeteer-extra-plugin-stealth`
2. Removing automation signals (for example `--enable-automation`, `navigator.webdriver`)
3. Attempting to auto-solve the "Press & Hold" challenge
4. Allowing manual solve time in non-headless mode if auto-solve fails

Best reliability is with:

```bash
BROWSER_HEADLESS=false
```

## Notes

- Selectors may require updates if source site markup changes.
- Product failures are isolated; one failed scrape does not stop others.
- Total Wine price can vary by store/location and may depend on your detected region.
