import { normalizedKey } from "./matching.js";

// Groups listings that look like the same job posted across multiple
// sources (e.g. an aggregator like Jora republishing a SEEK listing) into
// a single digest entry, so the same job doesn't show up twice.
export function groupListings(listings) {
  const groups = new Map();

  for (const listing of listings) {
    const key = normalizedKey(listing);
    if (!groups.has(key)) {
      groups.set(key, {
        normalizedKey: key,
        title: listing.title,
        company: listing.company,
        location: listing.location,
        postedAt: listing.postedAt,
        salary: listing.salary || "",
        entries: [],
      });
    }
    const group = groups.get(key);
    group.entries.push({ source: listing.source, url: listing.url });
    // Keep the earliest known posting date across duplicate entries.
    if (listing.postedAt && (!group.postedAt || listing.postedAt < group.postedAt)) {
      group.postedAt = listing.postedAt;
    }
    // Fill in salary from whichever duplicate entry happens to have it.
    if (!group.salary && listing.salary) {
      group.salary = listing.salary;
    }
  }

  return Array.from(groups.values());
}
