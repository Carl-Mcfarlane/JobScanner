// Absolute IT (absoluteit.co.nz) scraper — NZ IT-specific recruitment
// agency.
//
// robots.txt is wide open (only /wp-admin/ disallowed). The job listing
// page is genuinely static server-rendered HTML with clean semantic
// markup (WordPress + a job-board theme) — no JSON blob, no headless
// browser, just parse the HTML directly. Standard WordPress pagination
// (/it-jobs/page/N/).
//
// The actual hiring company isn't disclosed on agency listings (standard
// recruiter practice — client confidentiality until you apply), so
// `company` is set to "Absolute IT" throughout.

import { decodeHtmlEntities } from "../format.js";

const BASE_URL = "https://absoluteit.co.nz/it-jobs/";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-NZ,en;q=0.9",
};

const MAX_PAGES = 6;
const REQUEST_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseDate(str) {
  // "07 Aug 2026"
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function extractJobs(html) {
  const cards = html.split('<div class="card card-job">').slice(1);
  const jobs = [];
  for (const card of cards) {
    const title = card.match(/card-job__title">([^<]*)</)?.[1]?.trim();
    const location = card.match(/card-job__location">\s*<a[^>]*>([^<]*)</)?.[1]?.trim();
    const url = card.match(/<a href="([^"]+)" class="btn btn-outline-primary">/)?.[1];
    const dateStr = card.match(/card-job__date">([^<]*)</)?.[1]?.trim();
    const reference = card.match(/card-job__reference">([^<]*)</)?.[1]?.trim();
    const salary = card.match(/card-job__salary">\s*([^<]*)</)?.[1]?.trim();

    if (!title || !url) continue;
    jobs.push({
      source: "absoluteit",
      sourceId: reference || url,
      url,
      title: decodeHtmlEntities(title),
      company: "Absolute IT",
      location: decodeHtmlEntities(location || ""),
      postedAt: dateStr ? parseDate(dateStr) : null,
      salary: salary ? decodeHtmlEntities(salary) : "",
    });
  }
  return jobs;
}

function findMaxPage(html) {
  const pages = [...html.matchAll(/it-jobs\/page\/(\d+)\//g)].map((m) => parseInt(m[1], 10));
  return pages.length > 0 ? Math.min(Math.max(...pages), MAX_PAGES) : 1;
}

async function fetchPage(page) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;
  const res = await fetch(url, { headers: REQUEST_HEADERS });
  if (!res.ok) {
    throw new Error(`Absolute IT request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.text();
}

export async function fetchAbsoluteItListings({ log = () => {} } = {}) {
  const byId = new Map();

  const firstPageHtml = await fetchPage(1);
  const maxPage = findMaxPage(firstPageHtml);
  let jobs = extractJobs(firstPageHtml);
  for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
  log(`absoluteit: page 1 — ${jobs.length} jobs (of ${maxPage} pages)`);

  for (let page = 2; page <= maxPage; page++) {
    await sleep(REQUEST_DELAY_MS);
    const html = await fetchPage(page);
    jobs = extractJobs(html);
    for (const j of jobs) if (!byId.has(j.sourceId)) byId.set(j.sourceId, j);
    log(`absoluteit: page ${page} — ${jobs.length} jobs`);
  }

  return Array.from(byId.values());
}
