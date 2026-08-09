// Madison Recruitment (madison.co.nz) scraper — general NZ recruitment
// agency (not IT-specific), so most listings will be filtered out by
// KEYWORDS — same tradeoff as any broad source, consistent with how
// SEEK/SEEK Grad are handled.
//
// robots.txt wide open. Same WordPress job-board platform/theme as
// Absolute IT (near-identical "card-job" markup, just a different class
// naming scheme) — static server-rendered HTML, standard WordPress
// pagination (/jobs/page/N/). No visible posted-date field on the
// listing card (unlike Absolute IT), so postedAt is left null.

import { decodeHtmlEntities } from "../format.js";

const BASE_URL = "https://madison.co.nz/jobs/";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-NZ,en;q=0.9",
};

const MAX_PAGES = 8;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJobs(html) {
  const cards = html.split('class="card-job post-').slice(1);
  const jobs = [];
  for (const card of cards) {
    const titleMatch = card.match(/card-job__title">\s*<a href="([^"]+)">([^<]*)</);
    const location = card.match(/card-job__location">.*?<a[^>]*>([^<]*)</s)?.[1]?.trim();

    if (!titleMatch) continue;
    const [, url, title] = titleMatch;
    jobs.push({
      source: "madison",
      sourceId: url,
      url,
      title: decodeHtmlEntities(title.trim()),
      company: "Madison Recruitment",
      location: decodeHtmlEntities(location || ""),
      postedAt: null,
    });
  }
  return jobs;
}

function findMaxPage(html) {
  const pages = [...html.matchAll(/jobs\/page\/(\d+)/g)].map((m) => parseInt(m[1], 10));
  return pages.length > 0 ? Math.min(Math.max(...pages), MAX_PAGES) : 1;
}

async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Madison request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.text();
}

export async function fetchMadisonListings({ log = () => {} } = {}) {
  const byId = new Map();

  const firstPageHtml = await fetchPage(1);
  const maxPage = findMaxPage(firstPageHtml);
  let jobs = extractJobs(firstPageHtml);
  for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
  log(`madison: page 1 — ${jobs.length} jobs (of ${maxPage} pages)`);

  for (let page = 2; page <= maxPage; page++) {
    await sleep(REQUEST_DELAY_MS);
    const html = await fetchPage(page);
    jobs = extractJobs(html);
    for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
    log(`madison: page ${page} — ${jobs.length} jobs`);
  }

  return Array.from(byId.values());
}
