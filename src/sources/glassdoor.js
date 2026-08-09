// Glassdoor NZ scraper.
//
// robots.txt disallows /search/, /api/, and paginated job search URLs
// (any /Job/*_IP* or /Jobs/*_IP*.htm* — Glassdoor's pagination marker),
// but a first-page, non-paginated search URL like
// /Job/new-zealand-{keyword}-jobs-SRCH_IL.0,11_IN186_KO12,{end}.htm isn't
// covered by any disallow rule. So: page 1 only, no pagination — acceptable
// for this niche/NZ volume (Glassdoor NZ tech listings run in the low
// tens per keyword, not hundreds).
//
// The page is a Next.js app that streams job data via React Server
// Component payloads (self.__next_f.push(...) chunks), not a clean single
// JSON blob like SEEK/SEEK Grad. Fully reconstructing the RSC wire format
// is a lot of complexity for 15-30 results a day, so instead: reassemble
// the streamed text, then pull each job record's fields (jobTitleText,
// employerNameFromSearch, locationName, seoJobLink) via regex from a
// window around each title match. Validated against a real NZ search
// page — correctly extracted all 15 jobs with no false positives.

const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-NZ,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.google.com/",
  "Upgrade-Insecure-Requests": "1",
};

const NZ_LOCATION_ID = 186;
const SEED_KEYWORDS = [
  "software engineering intern",
  "software engineer graduate",
  "graduate engineer",
  "engineering intern",
  "graduate software",
];
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchUrl(keyword) {
  const slug = keyword.trim().toLowerCase().replace(/\s+/g, "-");
  const end = 12 + slug.length;
  return `https://www.glassdoor.co.nz/Job/new-zealand-${slug}-jobs-SRCH_IL.0,11_IN${NZ_LOCATION_ID}_KO12,${end}.htm`;
}

// Reassembles the RSC-streamed text: each self.__next_f.push([id, "chunk"])
// call carries a fragment of a larger newline-delimited record stream —
// concatenating all chunk strings in document order reconstructs it.
function reassembleStreamedText(html) {
  const marker = "self.__next_f.push(";
  const parts = [];
  let pos = 0;
  while ((pos = html.indexOf(marker, pos)) !== -1) {
    const start = pos + marker.length;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let i = start;
    let arrStart = -1;
    for (; i < html.length; i++) {
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
      if (c === "[") {
        if (depth === 0) arrStart = i;
        depth++;
      } else if (c === "]") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (arrStart !== -1) {
      const raw = html.slice(arrStart, i + 1);
      try {
        const [, content] = JSON.parse(raw);
        if (typeof content === "string") parts.push(content);
      } catch {
        // not a [id, "string"] chunk (e.g. binary/other push shapes) — skip
      }
    }
    pos = i;
  }
  return parts.join("");
}

function extractJobs(streamedText) {
  const jobs = [];
  const seen = new Set();
  const titleRe = /"jobTitleText":"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = titleRe.exec(streamedText))) {
    const windowStart = Math.max(0, match.index - 1500);
    const windowEnd = Math.min(streamedText.length, match.index + 500);
    const window = streamedText.slice(windowStart, windowEnd);

    const employerMatch =
      window.match(/"employerNameFromSearch":"((?:[^"\\]|\\.)*)"/) ||
      window.match(/"employerName":"((?:[^"\\]|\\.)*)"/);
    const locationMatch = window.match(/"locationName":"((?:[^"\\]|\\.)*)"/);
    const seoLinkMatch = window.match(/"seoJobLink":"((?:[^"\\]|\\.)*)"/);

    const url = seoLinkMatch ? seoLinkMatch[1].replace(/\\u002F/g, "/") : null;
    const idMatch = url && url.match(/[?&]jl=(\d+)/);
    const id = idMatch ? idMatch[1] : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);

    jobs.push({
      sourceId: id,
      title: match[1],
      company: employerMatch ? employerMatch[1] : "",
      location: locationMatch ? locationMatch[1] : "",
      url,
    });
  }
  return jobs;
}

async function fetchKeywordResults(keyword) {
  const url = buildSearchUrl(keyword);
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Glassdoor request failed: ${res.status} ${res.statusText} (${url})`);
  }
  const html = await res.text();
  const streamedText = reassembleStreamedText(html);
  return extractJobs(streamedText);
}

export async function fetchGlassdoorListings({ log = () => {} } = {}) {
  const byId = new Map();

  for (const keyword of SEED_KEYWORDS) {
    const jobs = await fetchKeywordResults(keyword);
    let added = 0;
    for (const job of jobs) {
      if (!job.url || byId.has(job.sourceId)) continue;
      byId.set(job.sourceId, {
        source: "glassdoor",
        sourceId: job.sourceId,
        url: job.url,
        title: job.title,
        company: job.company,
        location: job.location,
        // Glassdoor's SERP doesn't expose a posting date in this payload —
        // leave null rather than guessing; digest/homepage handle it as
        // "date unknown".
        postedAt: null,
      });
      added++;
    }
    log(`glassdoor: "${keyword}" — ${jobs.length} jobs on page, ${added} new`);
    await sleep(REQUEST_DELAY_MS);
  }

  return Array.from(byId.values());
}
