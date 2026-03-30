import { buildReport } from "./cli/report";
import { loadTrackedProducts } from "./config/products";
import { pollOnce, startPolling } from "./poller/poll";
import { getAdapter } from "./sources/resolver";
import { initializeDatabase } from "./storage/db";
import { PriceRepository } from "./storage/repository";

type Command = "poll" | "run-once" | "report";

function printHelp(): void {
  console.log(`Usage:
  npm run poll       # Starts scheduler and captures immediately
  npm run run-once   # Captures a single snapshot and exits
  npm run report     # Prints initial/current/trend report
`);
}

async function runOnce(repository: PriceRepository): Promise<void> {
  const products = loadTrackedProducts();
  const results = await pollOnce(products, repository);
  for (const result of results) {
    const status = result.success ? "ok" : "error";
    console.log(`[${status}] ${result.productId}: ${result.message}`);
  }
}

async function run(): Promise<void> {
  const command = (process.argv[2] as Command | undefined) ?? "report";
  if (!["poll", "run-once", "report"].includes(command)) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const dbPath = process.env.DB_PATH ?? "./price-tracker.db";
  const sqlite = await initializeDatabase(dbPath);
  const repository = new PriceRepository(sqlite);

  if (command === "run-once") {
    await runOnce(repository);
    sqlite.close();
    return;
  }

  if (command === "poll") {
    const products = loadTrackedProducts();
    for (const product of products) {
      // Fail fast on invalid source identifiers before scheduler starts.
      getAdapter(product.source);
    }

    const intervalHours = Number.parseInt(process.env.POLL_INTERVAL_HOURS ?? "6", 10);
    console.log(`Starting poller. Interval: ${intervalHours} hour(s).`);
    await startPolling(products, repository, intervalHours);
    return;
  }

  const products = loadTrackedProducts();
  console.log(buildReport(products, repository));
  sqlite.close();
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
