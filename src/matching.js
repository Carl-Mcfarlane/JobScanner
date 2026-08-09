import { LOCATIONS, KEYWORDS } from "./config.js";

export function matchesLocation(locationLabel, locations = LOCATIONS) {
  if (!locationLabel) return false;
  const label = locationLabel.toLowerCase();
  return locations.some((loc) => label.includes(loc.toLowerCase()));
}

export function matchesKeyword(title, keywords = KEYWORDS) {
  if (!title) return false;
  const t = title.toLowerCase();
  return keywords.some((kw) => t.includes(kw.toLowerCase()));
}

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Best-effort cross-source identity key. Same title+company+location
// normalized to plain lowercase alphanumeric tokens — good enough to catch
// aggregators (e.g. Jora) republishing another source's listing verbatim.
// Free-text location formats differ per source, so this is a heuristic,
// not a guarantee.
export function normalizedKey({ title, company, location }) {
  return [normalize(title), normalize(company), normalize(location)].join("|");
}
