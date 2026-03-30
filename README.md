# Price Tracker App

Track price history for products on Total Wine and PlayStation, then report:

- Initial price
- Current price
- Price trend (up/down/flat)

## Features

- Node.js + TypeScript CLI app
- Total Wine: headless Chrome via Puppeteer with stealth plugin (handles PerimeterX bot protection)
- PlayStation: direct HTTP with JSON-LD extraction
- SQLite persistence for historical snapshots
- Scheduled polling and one-off capture mode
- Trend analytics with absolute and percent change

## Quick Start

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. (Optional) configure env vars:

```bash
cp .env.example .env
```

3. Capture a single snapshot:

```bash
BROWSER_HEADLESS=false npm run run-once
```

4. View report:

```bash
npm run report
```

5. Start scheduler (runs immediately, then every `POLL_INTERVAL_HOURS`):

```bash
BROWSER_HEADLESS=false npm run poll
```

## Configuration

Environment variables:

- `DB_PATH`: SQLite file path. Default: `./price-tracker.db`
- `POLL_INTERVAL_HOURS`: Poll interval. Default: `6`
- `BROWSER_HEADLESS`: Set to `false` for Total Wine (recommended). Default: `true`

### Tracked Products

Edit `products.json` in the project root to add, remove, or change tracked products:

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

- `total-wine` (uses Puppeteer headless Chrome)
- `playstation` (uses direct HTTP)

## Commands

- `npm run run-once`: poll one time and exit
- `npm run poll`: poll immediately and then on a recurring interval
- `npm run report`: print initial/current/trend data
- `npm run dashboard`: open a web UI at http://localhost:3000 with interactive price charts
- `npm run test`: run unit tests

## Total Wine Bot Protection

Total Wine uses PerimeterX bot protection. The app handles this by:

1. Using `puppeteer-extra-plugin-stealth` to mask browser automation signals
2. Removing the `--enable-automation` flag and patching `navigator.webdriver`
3. Attempting to auto-solve the "Press & Hold" challenge
4. In non-headless mode (`BROWSER_HEADLESS=false`), if auto-solve fails, giving you 60 seconds to solve it manually in the opened browser window

For best results, always run with `BROWSER_HEADLESS=false`.

## Notes

- Site HTML can change, so selectors may need updates over time.
- Polling uses graceful per-product failure handling; one failure does not abort other products.
- Total Wine prices vary by store location; the price captured depends on the default store for your IP.
