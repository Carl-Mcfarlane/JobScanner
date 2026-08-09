// Randstad NZ (randstad.co.nz) scraper.
//
// robots.txt: base `Allow: /`, with specific disallows for filter/sort/
// pagination query patterns (/*search=, /*/mpage-, /*/sd-, etc.) — plain
// location landing pages aren't covered by any of those.
//
// Each listing page embeds a Google Tag Manager `window.dataLayer` push
// with a clean `ecommerce.impressions[]` array (job_title, job_id,
// category, city, region, url, launch_date, salary — an analytics
// tracking payload, but genuinely convenient structured data). Using the
// per-location landing pages (/jobs/{region}/{city}/) rather than the
// general /jobs/ page sidesteps that page's pagination entirely — each
// location page renders its full result set in one request (confirmed:
// Auckland showed 11/11 with no pagination needed) — and maps directly
// onto our configured LOCATIONS. If LOCATIONS in config.js changes, these
// URLs need updating too (same pattern as Prosple's seed pages).

const BASE_URL = "https://www.randstad.co.nz";
const LOCATION_PAGES = [
  "/jobs/auckland/auckland/",
  "/jobs/waikato/hamilton/",
  "/jobs/bay-of-plenty/tauranga/",
];

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-NZ,en;q=0.9",
};

const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractDataLayer(html) {
  const marker = "const data = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  try {
    return JSON.parse(html.slice(jsonStart, end));
  } catch {
    return null;
  }
}

function toListing(item) {
  if (!item.url) return null;
  const location = [item.city, item.region].filter(Boolean).join(", ");
  return {
    source: "randstad",
    sourceId: item.job_id,
    url: `${BASE_URL}${item.url}`,
    title: item.job_title || "",
    company: "Randstad",
    location,
    postedAt: item.launch_date ? new Date(item.launch_date) : null,
    salary: salaryText(item),
  };
}

function salaryText(item) {
  if (!item.minimum_salary || !item.maximum_salary) return "";
  return `$${item.minimum_salary.toLocaleString()} - $${item.maximum_salary.toLocaleString()}`;
}

async function fetchLocationPage(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Randstad request failed: ${res.status} ${res.statusText} (${url})`);
  }
  const html = await res.text();
  const data = extractDataLayer(html);
  if (!data) {
    throw new Error(`Could not find/parse dataLayer on Randstad page (${url})`);
  }
  return {
    impressions: data.ecommerce?.impressions || [],
    total: data.page?.search_results?.search_result_amount ?? 0,
  };
}

export async function fetchRandstadListings({ log = () => {} } = {}) {
  const byId = new Map();

  for (const path of LOCATION_PAGES) {
    const { impressions, total } = await fetchLocationPage(path);
    let added = 0;
    for (const item of impressions) {
      const listing = toListing(item);
      if (listing && listing.sourceId && !byId.has(listing.sourceId)) {
        byId.set(listing.sourceId, listing);
        added++;
      }
    }
    log(`randstad: "${path}" — ${impressions.length}/${total} jobs on page, ${added} new`);
    if (impressions.length < total) {
      log(`randstad: "${path}" has more results than shown on one page (${impressions.length}/${total}) — not paginating (robots.txt disallows the pagination query param)`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}
