// Small formatting helpers shared between the email digest (email.js) and
// the homepage (api/home.js), so both present listings consistently.

const SOURCE_LABELS = {
  seek: "SEEK",
  seekgrad: "SEEK Grad",
  trademe: "Trade Me",
  prosple: "Prosple",
  jora: "Jora",
  glassdoor: "Glassdoor",
  indeed: "Indeed",
  linkedin: "LinkedIn",
};

export function formatDate(date) {
  if (!date) return "date unknown";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#039": "'",
  apos: "'",
  nbsp: " ",
};

// For scrapers pulling text out of raw HTML (not a JSON API) — WordPress
// and similar CMSes entity-encode titles/locations (e.g. "&amp;", "&#8211;").
export function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z#0-9]+);/gi, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m));
}

export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sortByPostedAtDesc(groups) {
  return [...groups].sort((a, b) => {
    const aTime = a.postedAt ? a.postedAt.getTime() : 0;
    const bTime = b.postedAt ? b.postedAt.getTime() : 0;
    return bTime - aTime;
  });
}
