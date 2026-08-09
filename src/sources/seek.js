// SEEK NZ scraper.
//
// SEEK server-renders its job search results page with a complete listing
// dataset embedded as `window.SEEK_REDUX_DATA = {...}` — no headless
// browser needed, just fetch the HTML and parse that JSON blob out.
//
// robots.txt (https://www.seek.co.nz/robots.txt) disallows `*/job/`
// (individual job detail pages), `/graphql`, and `/api/jobsearch/`, but
// explicitly ALLOWS `*?keywords` search URLs. We only ever hit the search
// page — it already has everything we need (title, company, location,
// posted date, job id) — so we never touch a disallowed path. The
// `keywords` param must stay the first query param on the URL, since the
// robots.txt allow-rule matches on the literal substring "?keywords".

// www.seek.co.nz redirects (308) to nz.seek.com — hit the canonical host
// directly to save a round trip. robots.txt is served identically on both
// (the www host's robots.txt itself redirects to nz.seek.com's).
const BASE_URL = "https://nz.seek.com/jobs";

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.google.com/",
  "Upgrade-Insecure-Requests": "1",
};

// Seed queries used to pull a candidate pool from SEEK's search. SEEK's
// matching is fuzzy/relevance-based, not a strict substring match, so these
// exist purely to surface tech-relevant candidates cheaply — the real
// filtering (config KEYWORDS + LOCATIONS) happens afterward in matching.js.
// A single broad term like "graduate" alone returns ~19k results across
// every industry, so each seed query pairs a broad term with a tech/dev
// qualifier to keep the candidate pool a manageable size.
const SEARCH_QUERIES = [
  "software engineer",
  "software intern",
  "graduate developer",
  "graduate programme technology",
];

const MAX_PAGES_PER_QUERY = 4;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractReduxJson(html) {
  const marker = "window.SEEK_REDUX_DATA = ";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;

  // Brace-depth scan (string-aware) to find the end of the JSON object —
  // simpler and more robust than trying to regex-match up to "</script>".
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < html.length; i++) {
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
    return JSON.parse(html.slice(start, end));
  } catch {
    return null;
  }
}

function toListing(job) {
  const location = job.locations?.[0]?.label || "";
  return {
    source: "seek",
    sourceId: String(job.id),
    url: `https://nz.seek.com/job/${job.id}`,
    title: job.title || "",
    company: job.companyName || job.advertiser?.description || "",
    location,
    postedAt: job.listingDate ? new Date(job.listingDate) : null,
    salary: job.salaryLabel || "",
  };
}

async function fetchSearchPage(query, page) {
  // `keywords` must be the first query param — see robots.txt note above.
  const url = `${BASE_URL}?keywords=${encodeURIComponent(query)}&page=${page}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });

  if (!res.ok) {
    throw new Error(`SEEK search request failed: ${res.status} ${res.statusText} (${url})`);
  }

  const html = await res.text();
  const data = extractReduxJson(html);
  if (!data) {
    throw new Error(`Could not find/parse SEEK_REDUX_DATA on search page (${url})`);
  }

  const jobs = data.results?.results?.jobs || [];
  const totalCount = data.results?.totalCount ?? 0;
  return { jobs, totalCount };
}

export async function fetchSeekListings({ log = () => {} } = {}) {
  const byId = new Map();

  for (const query of SEARCH_QUERIES) {
    let page = 1;
    let seenAnyThisQuery = false;

    while (page <= MAX_PAGES_PER_QUERY) {
      const { jobs, totalCount } = await fetchSearchPage(query, page);

      if (jobs.length === 0) break;
      seenAnyThisQuery = true;

      for (const job of jobs) {
        const listing = toListing(job);
        if (listing.sourceId && !byId.has(listing.sourceId)) {
          byId.set(listing.sourceId, listing);
        }
      }

      log(`seek: "${query}" page ${page} — ${jobs.length} jobs (of ${totalCount} total)`);

      const jobsPerPage = jobs.length;
      const fetchedSoFar = page * jobsPerPage;
      if (fetchedSoFar >= totalCount) break;

      page++;
      if (page <= MAX_PAGES_PER_QUERY) await sleep(REQUEST_DELAY_MS);
    }

    if (!seenAnyThisQuery) {
      log(`seek: "${query}" returned no results`);
    }

    // Delay between different seed queries too, not just between pages.
    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}
