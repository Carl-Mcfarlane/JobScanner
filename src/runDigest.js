import { fetchAllListings } from "./sources/index.js";
import { matchesLocation, matchesKeyword, normalizedKey } from "./matching.js";
import { groupListings } from "./dedupe.js";
import { sendDigest } from "./email.js";
import { getListingsCollection, getState, saveState } from "./db.js";

// End-to-end pipeline: scrape -> location filter -> keyword filter ->
// diff against what we've already seen -> cross-source dedupe -> email.
//
// Returns a summary object rather than throwing on "nothing new" — the
// caller (cron handler / local script) decides what to do with it.
export async function runDigest({ log = console.log, dryRun = false } = {}) {
  const raw = await fetchAllListings({ log });
  log(`Fetched ${raw.length} raw candidate listings total`);

  const matching = raw.filter(
    (l) => matchesLocation(l.location) && matchesKeyword(l.title)
  );
  log(`${matching.length} listings match location + keyword filters`);

  const state = await getState();
  const isFirstRun = !state.hasRunBefore;

  const listingsCollection = await getListingsCollection();
  const existingDocs = await listingsCollection
    .find(
      { source: { $in: [...new Set(matching.map((l) => l.source))] } },
      { projection: { source: 1, sourceId: 1 } }
    )
    .toArray();
  const existingKeys = new Set(existingDocs.map((d) => `${d.source}:${d.sourceId}`));

  const newListings = isFirstRun
    ? matching
    : matching.filter((l) => !existingKeys.has(`${l.source}:${l.sourceId}`));
  log(
    isFirstRun
      ? `First run — treating all ${newListings.length} matching listings as backfill`
      : `${newListings.length} listings are new since last run`
  );

  const groups = groupListings(newListings);
  log(`Grouped into ${groups.length} deduped digest entries`);

  const now = new Date();

  if (!dryRun) {
    const bulkOps = matching.map((l) => ({
      updateOne: {
        filter: { source: l.source, sourceId: l.sourceId },
        update: {
          $setOnInsert: {
            source: l.source,
            sourceId: l.sourceId,
            url: l.url,
            title: l.title,
            company: l.company,
            location: l.location,
            postedAt: l.postedAt,
            salary: l.salary || "",
            normalizedKey: normalizedKey(l),
            firstSeenAt: now,
          },
        },
        upsert: true,
      },
    }));
    if (bulkOps.length > 0) {
      await listingsCollection.bulkWrite(bulkOps, { ordered: false });
    }
  }

  let emailSent = false;
  if (groups.length > 0) {
    if (!dryRun) {
      await sendDigest(groups, { isFirstRun });
    }
    emailSent = true;
    log(`Digest ${dryRun ? "(dry run, not actually sent)" : "sent"}: ${groups.length} entries`);
  } else {
    log("No new matching listings — skipping email.");
  }

  if (!dryRun) {
    await saveState({ hasRunBefore: true, lastRunAt: now });
  }

  return { totalFetched: raw.length, matchingCount: matching.length, newCount: newListings.length, groups, emailSent, isFirstRun };
}
