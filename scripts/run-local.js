// Run the full pipeline locally without deploying — useful for testing
// the scraper/filter/dedupe/email chain end-to-end.
//
// Usage:
//   node scripts/run-local.js            (real run: writes to Mongo, sends email)
//   node scripts/run-local.js --dry-run  (fetches + filters + prints, no writes/email)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runDigest } from "../src/runDigest.js";

function loadEnvFile() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) return;

  const contents = readFileSync(envPath, "utf-8");
  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvFile();
  const dryRun = process.argv.includes("--dry-run");

  const result = await runDigest({ log: console.log, dryRun });

  console.log("\n--- Summary ---");
  console.log(`Fetched: ${result.totalFetched}`);
  console.log(`Matching location+keyword filters: ${result.matchingCount}`);
  console.log(`New since last run: ${result.newCount}`);
  console.log(`Digest entries (after cross-source dedupe): ${result.groups.length}`);
  console.log(`Email sent: ${result.emailSent && !dryRun}`);
  console.log(`First run (backfill mode): ${result.isFirstRun}`);

  if (dryRun && result.groups.length > 0) {
    console.log("\n--- Would-be digest contents ---");
    for (const g of result.groups) {
      const sources = g.entries.map((e) => `${e.source}:${e.url}`).join(", ");
      console.log(`- ${g.title} @ ${g.company} (${g.location}) [${sources}]`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Digest run failed:", err);
    process.exit(1);
  });
