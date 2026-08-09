// One-off comparison script (not part of the permanent pipeline) — shows
// which listings the old single-list substring KEYWORDS filter vs the new
// two-part KEYWORDS_ENTRY/KEYWORDS_TECH whole-word filter would each match,
// against a fresh live scrape. Run: node scripts/compare-keywords.mjs

import { readFileSync } from "node:fs";
import { fetchSeekGradListings } from "../src/sources/seekgrad.js";
import { fetchProspleListings } from "../src/sources/prosple.js";
import { matchesLocation, matchesKeyword } from "../src/matching.js";
import { getListingsCollection } from "../src/db.js";

// SEEK is temporarily rate-limiting this dev IP after a long day of test
// runs — skip re-scraping it live and instead reuse what's already in
// Mongo from earlier successful runs (still useful for checking the new
// filter doesn't drop anything SEEK had already matched under the old one).
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const OLD_KEYWORDS = ["intern", "internship", "graduate", "grad", "software engineer", "summer"];
function oldMatchesKeyword(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  return OLD_KEYWORDS.some((kw) => t.includes(kw.toLowerCase()));
}

const [seekgrad, prosple] = await Promise.all([
  fetchSeekGradListings({ log: () => {} }),
  fetchProspleListings({ log: () => {} }),
]);

const seekCollection = await getListingsCollection();
const seekDocs = await seekCollection.find({ source: "seek" }).toArray();

const raw = [...seekDocs, ...seekgrad, ...prosple];
const inNZLocations = raw.filter((l) => matchesLocation(l.location));

const oldMatches = new Map();
const newMatches = new Map();
for (const l of inNZLocations) {
  const key = `${l.source}:${l.sourceId}`;
  if (oldMatchesKeyword(l.title)) oldMatches.set(key, l);
  if (matchesKeyword(l.title)) newMatches.set(key, l);
}

const newlyMatched = [...newMatches.values()].filter((l) => !oldMatches.has(`${l.source}:${l.sourceId}`));
const noLongerMatched = [...oldMatches.values()].filter((l) => !newMatches.has(`${l.source}:${l.sourceId}`));
const matchedBoth = [...newMatches.values()].filter((l) => oldMatches.has(`${l.source}:${l.sourceId}`));

console.log(`\n=== SUMMARY (location-filtered candidates: ${inNZLocations.length}) ===`);
console.log(`Old filter matched: ${oldMatches.size}`);
console.log(`New filter matched: ${newMatches.size}`);
console.log(`Newly matched (broadened recall): ${newlyMatched.length}`);
console.log(`No longer matched (should be 0 or clearly-correct exclusions): ${noLongerMatched.length}`);
console.log(`Matched by both (unchanged): ${matchedBoth.length}`);

console.log(`\n=== NEWLY MATCHED (new filter catches, old filter missed) ===`);
for (const l of newlyMatched) console.log(`+ ${l.title} | ${l.company} | ${l.source}`);

console.log(`\n=== NO LONGER MATCHED (old filter caught, new filter excludes) ===`);
for (const l of noLongerMatched) console.log(`- ${l.title} | ${l.company} | ${l.source}`);

process.exit(0);
