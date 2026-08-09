import { getListingsCollection, getListingActionsCollection, getState } from "../src/db.js";
import { groupListings } from "../src/dedupe.js";
import { formatDate, sourceLabel, escapeHtml, sortByPostedAtDesc } from "../src/format.js";

// Simple read-only-ish homepage: shows everything currently in the
// `listings` collection, deduped the same way the email digest is, with
// Save/Remove buttons (backed by api/action.js, plain HTML forms, no
// client-side JS). No auth — job listings are public data anyway.

function actionForm({ key, status, returnTo, label }) {
  return `<form method="POST" action="/api/action" style="display:inline">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="status" value="${escapeHtml(status)}">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
    <button type="submit" class="btn btn-${status === "removed" ? "danger" : status === "clear" ? "plain" : "primary"}">${escapeHtml(label)}</button>
  </form>`;
}

function jobItem(g, { returnTo }) {
  const sources = g.entries
    .map((e) => `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(sourceLabel(e.source))}</a>`)
    .join(" · ");

  let actions;
  if (g.status === "saved") {
    actions = [
      actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Un-save" }),
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove" }),
    ].join(" ");
  } else if (g.status === "removed") {
    actions = actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Restore" });
  } else {
    actions = [
      actionForm({ key: g.normalizedKey, status: "saved", returnTo, label: "Save" }),
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove" }),
    ].join(" ");
  }

  return `
    <li class="job">
      <div class="title">${escapeHtml(g.title)}</div>
      <div class="company">${escapeHtml(g.company)}</div>
      <div class="meta">${escapeHtml(g.location || "Location not specified")} — Posted ${formatDate(g.postedAt)}</div>
      <div class="sources">${sources}</div>
      <div class="actions">${actions}</div>
    </li>`;
}

function renderPage({ view, savedGroups, activeGroups, removedCount, lastRunAt }) {
  const lastRunText = lastRunAt
    ? new Intl.DateTimeFormat("en-NZ", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Pacific/Auckland",
      }).format(lastRunAt)
    : "never";

  const body =
    view === "removed"
      ? `
      <div class="subtitle"><a href="/">&larr; Back</a></div>
      <h1>Removed jobs</h1>
      <ul>
        ${activeGroups.map((g) => jobItem(g, { returnTo: "/?view=removed" })).join("\n") || `<li class="empty">Nothing removed.</li>`}
      </ul>`
      : `
      <h1>NZ Tech Intern/Grad Jobs</h1>
      <div class="subtitle">
        ${savedGroups.length + activeGroups.length} listing${savedGroups.length + activeGroups.length === 1 ? "" : "s"} —
        last scrape ran ${lastRunText} —
        <a href="/?view=removed">removed (${removedCount})</a>
      </div>
      ${
        savedGroups.length > 0
          ? `<h2>★ Saved</h2><ul>${savedGroups.map((g) => jobItem(g, { returnTo: "/" })).join("\n")}</ul><h2>New</h2>`
          : ""
      }
      <ul>
        ${activeGroups.map((g) => jobItem(g, { returnTo: "/" })).join("\n") || `<li class="empty">Nothing here.</li>`}
      </ul>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NZ Tech Intern/Grad Jobs</title>
<style>
  body { font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; color: #1a1a1a; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  h2 { font-size: 1rem; color: #444; margin: 24px 0 8px; }
  .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 8px; }
  .subtitle a { color: #0060df; }
  ul { list-style: none; padding: 0; margin: 0; }
  .job { padding: 14px 0; border-bottom: 1px solid #e5e5e5; }
  .title { font-weight: 600; }
  .company { color: #333; }
  .meta { color: #666; font-size: 0.9rem; margin-top: 2px; }
  .sources { margin-top: 4px; font-size: 0.9rem; }
  .sources a { color: #0060df; text-decoration: none; }
  .sources a:hover { text-decoration: underline; }
  .actions { margin-top: 8px; }
  .btn { font-size: 0.85rem; padding: 4px 10px; border-radius: 4px; border: 1px solid #ccc; background: #f7f7f7; cursor: pointer; margin-right: 6px; }
  .btn-primary { border-color: #0060df; color: #0060df; }
  .btn-danger { border-color: #c9302c; color: #c9302c; }
  .btn:hover { background: #eee; }
  .empty { color: #666; padding: 40px 0; text-align: center; }
</style>
</head>
<body>
  ${body}
</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    const view = req.query?.view === "removed" ? "removed" : "active";

    const collection = await getListingsCollection();
    const docs = await collection.find({}).sort({ postedAt: -1 }).limit(500).toArray();
    const actionsCollection = await getListingActionsCollection();
    const actionDocs = await actionsCollection.find({}).toArray();
    const statusByKey = new Map(actionDocs.map((d) => [d._id, d.status]));

    const state = await getState();

    const allGroups = sortByPostedAtDesc(groupListings(docs)).map((g) => ({
      ...g,
      status: statusByKey.get(g.normalizedKey) || null,
    }));

    const savedGroups = allGroups.filter((g) => g.status === "saved");
    const removedGroups = allGroups.filter((g) => g.status === "removed");
    const activeGroups = allGroups.filter((g) => g.status !== "saved" && g.status !== "removed");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(
      renderPage({
        view,
        savedGroups,
        activeGroups: view === "removed" ? removedGroups : activeGroups,
        removedCount: removedGroups.length,
        lastRunAt: state.lastRunAt || null,
      })
    );
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>Failed to load listings: ${err.message}</pre>`);
  }
}
