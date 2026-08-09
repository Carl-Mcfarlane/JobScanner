// SEEK Grad (nz.gradconnection.com) scraper.
//
// SEEK Grad is SEEK's rebrand of GradConnection — a separate site/platform
// from the main nz.seek.com search, dedicated to NZ graduate jobs and
// internships. robots.txt is wide open (`Disallow:` with no path), and
// each listing page server-renders a `window.__initialState__` blob
// (same style as SEEK's window.SEEK_REDUX_DATA) containing every listing
// on the page — title, company, a plain array of location names, and
// application dates — no headless browser needed.
//
// One quirk: the blob is a JS object literal, not strict JSON (it contains
// bare `undefined` values), so it needs a small sanitize step before
// JSON.parse.

const BASE_URL = "https://nz.gradconnection.com";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
};

// The two listing sections that map onto our KEYWORDS categories.
const SECTIONS = ["/graduate-jobs/", "/internships/"];
const MAX_PAGES_PER_SECTION = 8;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractInitialState(html) {
  const marker = "window.__initialState__ = ";
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;

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

  // Object literal, not strict JSON — swap bare `undefined` values for
  // `null` so JSON.parse can handle it.
  const jsonStr = html.slice(start, end).replace(/:undefined(?=[,}])/g, ":null");
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function salaryText(salary) {
  if (!salary) return "";
  if (salary.details) return salary.details;
  if (salary.min_salary && salary.max_salary) return `$${salary.min_salary} - $${salary.max_salary}`;
  return "";
}

function toListings(campaignGroup) {
  const company = campaignGroup.customer_organization?.name || "";
  return (campaignGroup.campaigns || [])
    // "notify_me" campaigns are companies' generic "register your interest"
    // mailing-list signups, not actual open listings — real listings are
    // "campaign_group". Filtering on this field rather than the title text
    // (which happens to start with "Notify Me - " for these, but that's
    // incidental copy, not a stable contract).
    .filter((c) => c.item_type !== "notify_me")
    .map((c) => ({
      source: "seekgrad",
      sourceId: c.id,
      url: c.origin_target_url || `${BASE_URL}${c.target_url}`,
      title: c.title || "",
      company,
      location: (c.locations || []).join(", "),
      postedAt: c.interval?.start ? new Date(c.interval.start) : null,
      salary: salaryText(c.salary),
    }));
}

async function fetchSectionPage(section, page) {
  const url = `${BASE_URL}${section}${page > 1 ? `?page=${page}` : ""}`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`SEEK Grad request failed: ${res.status} ${res.statusText} (${url})`);
  }
  const html = await res.text();
  const state = extractInitialState(html);
  if (!state) {
    throw new Error(`Could not find/parse window.__initialState__ on SEEK Grad page (${url})`);
  }
  const store = state.campaigngroupstore || {};
  return {
    groups: store.campaignGroups || [],
    totalCount: store.count ?? 0,
    pageSize: store.paginateBy || 20,
  };
}

export async function fetchSeekGradListings({ log = () => {} } = {}) {
  const byId = new Map();

  for (const section of SECTIONS) {
    let page = 1;
    while (page <= MAX_PAGES_PER_SECTION) {
      const { groups, totalCount, pageSize } = await fetchSectionPage(section, page);
      if (groups.length === 0) break;

      for (const group of groups) {
        for (const listing of toListings(group)) {
          if (listing.sourceId && !byId.has(listing.sourceId)) {
            byId.set(listing.sourceId, listing);
          }
        }
      }

      log(`seekgrad: "${section}" page ${page} — ${groups.length} groups (of ${totalCount} total)`);

      if (page * pageSize >= totalCount) break;
      page++;
      if (page <= MAX_PAGES_PER_SECTION) await sleep(REQUEST_DELAY_MS);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}
