import { SOURCES } from "../config.js";
import { fetchSeekListings } from "./seek.js";

// Each entry: sourceId -> fetch function returning normalized listings
// ({ source, sourceId, url, title, company, location, postedAt }[]).
// Add new sources here once their scraper is built and validated.
const SCRAPERS = {
  seek: fetchSeekListings,
};

export async function fetchAllListings({ log = () => {} } = {}) {
  const enabledIds = SOURCES.filter((s) => s.enabled).map((s) => s.id);
  const results = [];

  for (const id of enabledIds) {
    const scraper = SCRAPERS[id];
    if (!scraper) {
      log(`No scraper implemented yet for source "${id}", skipping.`);
      continue;
    }
    log(`Fetching listings from ${id}...`);
    const listings = await scraper({ log });
    log(`${id}: fetched ${listings.length} candidate listings`);
    results.push(...listings);
  }

  return results;
}
