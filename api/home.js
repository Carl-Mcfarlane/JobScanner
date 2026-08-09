import { getListingsCollection, getState } from "../src/db.js";
import { groupListings } from "../src/dedupe.js";
import { formatDate, sourceLabel, escapeHtml, sortByPostedAtDesc } from "../src/format.js";

// Simple read-only homepage: shows everything currently in the `listings`
// collection, deduped the same way the email digest is. No auth — job
// listings are public data anyway (that's what was scraped), so there's
// nothing sensitive being exposed here.

function renderPage({ groups, lastRunAt }) {
  const items = groups
    .map((g) => {
      const sources = g.entries
        .map((e) => `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(sourceLabel(e.source))}</a>`)
        .join(" · ");
      return `
        <li class="job">
          <div class="title">${escapeHtml(g.title)}</div>
          <div class="company">${escapeHtml(g.company)}</div>
          <div class="meta">${escapeHtml(g.location || "Location not specified")} — Posted ${formatDate(g.postedAt)}</div>
          <div class="sources">${sources}</div>
        </li>`;
    })
    .join("\n");

  const lastRunText = lastRunAt
    ? new Intl.DateTimeFormat("en-NZ", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Pacific/Auckland",
      }).format(lastRunAt)
    : "never";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NZ Tech Intern/Grad Jobs</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 24px; }
  ul { list-style: none; padding: 0; margin: 0; }
  .job { padding: 14px 0; border-bottom: 1px solid #e5e5e5; }
  .title { font-weight: 600; }
  .company { color: #333; }
  .meta { color: #666; font-size: 0.9rem; margin-top: 2px; }
  .sources { margin-top: 4px; font-size: 0.9rem; }
  .sources a { color: #0060df; text-decoration: none; }
  .sources a:hover { text-decoration: underline; }
  .empty { color: #666; padding: 40px 0; text-align: center; }
</style>
</head>
<body>
  <h1>NZ Tech Intern/Grad Jobs</h1>
  <div class="subtitle">${groups.length} listing${groups.length === 1 ? "" : "s"} matching your filters — last scrape ran ${lastRunText}</div>
  <ul>
    ${items || `<li class="empty">Nothing found yet.</li>`}
  </ul>
</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    const collection = await getListingsCollection();
    const docs = await collection.find({}).sort({ postedAt: -1 }).limit(500).toArray();
    const state = await getState();

    const groups = sortByPostedAtDesc(groupListings(docs));

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderPage({ groups, lastRunAt: state.lastRunAt || null }));
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>Failed to load listings: ${err.message}</pre>`);
  }
}
