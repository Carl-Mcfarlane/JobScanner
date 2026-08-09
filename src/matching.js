import { LOCATIONS, KEYWORDS_ENTRY, KEYWORDS_TECH } from "./config.js";

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word/whole-phrase matching, not naive substring — a plain
// `.includes()` would let "grad" match inside "upgrade" or "IT" match
// inside "recruitment". \b boundaries fix both while still matching
// multi-word/hyphenated phrases fine (the boundary only cares about the
// transition at each end, not what's inside).
function matchesAnyTerm(text, terms) {
  if (!text) return false;
  return terms.some((term) => new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text));
}

export function matchesLocation(locationLabel, locations = LOCATIONS) {
  return matchesAnyTerm(locationLabel, locations);
}

// A title must contain BOTH an entry-level signal AND a tech-domain
// signal — see config.js for why (keeps recall broad without also
// matching senior tech roles or non-tech graduate programmes).
export function matchesKeyword(title, entryTerms = KEYWORDS_ENTRY, techTerms = KEYWORDS_TECH) {
  return matchesAnyTerm(title, entryTerms) && matchesAnyTerm(title, techTerms);
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
// aggregators republishing another source's listing verbatim. Free-text
// location formats differ per source, so this is a heuristic, not a
// guarantee.
export function normalizedKey({ title, company, location }) {
  return [normalize(title), normalize(company), normalize(location)].join("|");
}
