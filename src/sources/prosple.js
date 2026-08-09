// Prosple (nz.prosple.com) scraper.
//
// robots.txt is permissive (only protected routes like /login, /sign-up
// are disallowed — no blanket disallow, no /search or /jobs block).
// Cloudflare returns an empty 202 to bare requests but resolves fine with
// realistic browser headers (same fix as SEEK needed).
//
// Prosple is a Next.js + Apollo GraphQL app. Each listing page embeds the
// full Apollo normalized cache inside the standard `__NEXT_DATA__` script
// tag (real JSON, not a JS object literal like SEEK Grad's blob). Rather
// than navigating to the exact query-result path (which is keyed by an
// unwieldy stringified variables blob), we just pull every `Opportunity:*`
// entry out of the cache directly — a single page load only ever
// normalizes in the entities it actually rendered, so this is equivalent
// and avoids depending on Apollo's internal key format.
//
// There's no generic keyword-search endpoint — Prosple uses pre-built SEO
// landing pages per category/location combo. We hit a small set of seed
// pages and let our own LOCATIONS/KEYWORDS filters (matching.js) do the
// real filtering, same approach as the SEEK seed queries.

const BASE_URL = "https://nz.prosple.com";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.google.com/",
  "Upgrade-Insecure-Requests": "1",
};

const SEED_PAGES = [
  "internships-in-auckland-new-zealand",
  "graduate-jobs-in-auckland-new-zealand",
  "engineering-internships-new-zealand",
  "graduate-jobs-new-zealand",
];

const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractNextData(html) {
  const marker = '<script id="__NEXT_DATA__" type="application/json">';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const contentStart = start + marker.length;
  const end = html.indexOf("</script>", contentStart);
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(contentStart, end));
  } catch {
    return null;
  }
}

// Finds the Apollo normalized-cache object: the first object anywhere in
// the tree that has at least one key starting with "Opportunity:".
function findApolloCache(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return null;
  if (!Array.isArray(node)) {
    if (Object.keys(node).some((k) => k.startsWith("Opportunity:"))) {
      return node;
    }
  }
  for (const value of Object.values(node)) {
    const found = findApolloCache(value, depth + 1);
    if (found) return found;
  }
  return null;
}

function toListing(entity, cache) {
  if (entity.expired) return null;

  const employer = entity.parentEmployer?.__ref ? cache[entity.parentEmployer.__ref] : null;
  const company = employer?.title || employer?.advertiserName || "";

  const locationParts = (entity.geoAddresses || []).flatMap((addr) =>
    [addr.locality, addr.region].filter(Boolean)
  );
  const location = [...new Set(locationParts)].join(", ");

  const url = entity.detailPageURL
    ? `${BASE_URL}${entity.detailPageURL}`
    : entity.applyByUrl || null;
  if (!url) return null;

  return {
    source: "prosple",
    sourceId: entity.id,
    url,
    title: entity.title || "",
    company,
    location,
    postedAt: entity.applicationsOpenDate ? new Date(entity.applicationsOpenDate) : null,
    salary: salaryText(entity),
  };
}

function salaryText(entity) {
  if (entity.hideSalary) return "";
  if (entity.salaryDescription) return entity.salaryDescription;
  if (entity.minSalary && entity.maxSalary) {
    const rate = entity.salary?.rate === "hourly" ? "/hr" : "";
    if (entity.minSalary === entity.maxSalary) {
      return `$${entity.minSalary.toLocaleString()}${rate}`;
    }
    return `$${entity.minSalary.toLocaleString()} - $${entity.maxSalary.toLocaleString()}${rate}`;
  }
  return "";
}

async function fetchSeedPage(slug) {
  const url = `${BASE_URL}/${slug}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Prosple request failed: ${res.status} ${res.statusText} (${url})`);
  }
  const html = await res.text();
  const nextData = extractNextData(html);
  if (!nextData) {
    throw new Error(`Could not find/parse __NEXT_DATA__ on Prosple page (${url})`);
  }
  const cache = findApolloCache(nextData);
  if (!cache) {
    throw new Error(`Could not find Apollo cache in __NEXT_DATA__ (${url})`);
  }
  return cache;
}

export async function fetchProspleListings({ log = () => {} } = {}) {
  const byId = new Map();

  for (const slug of SEED_PAGES) {
    const cache = await fetchSeedPage(slug);
    const opportunityKeys = Object.keys(cache).filter((k) => k.startsWith("Opportunity:"));

    let added = 0;
    for (const key of opportunityKeys) {
      const listing = toListing(cache[key], cache);
      if (listing && listing.sourceId && !byId.has(listing.sourceId)) {
        byId.set(listing.sourceId, listing);
        added++;
      }
    }
    log(`prosple: "${slug}" — ${opportunityKeys.length} opportunities on page, ${added} new`);

    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}
