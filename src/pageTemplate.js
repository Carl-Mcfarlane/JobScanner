import { formatDate, sourceLabel, escapeHtml } from "./format.js";

// Shared design system for the homepage / saved / removed views. Kept as
// plain CSS + string templates (no build step, no client JS beyond native
// HTML forms) — consistent with the rest of this project's "keep it
// simple" approach.

const STYLES = `
  :root {
    --paper: #f7f6f3;
    --ink: #15171a;
    --accent: #1f8a82;
    --accent-ink: #0d3d3a;
    --saved: #c89b3c;
    --danger: #b23a48;
    --card-bg: #ffffff;
    --border: #e4e1da;
    --text: #1c1e21;
    --text-muted: #6b6f76;
    --text-faint: #93979e;
    --mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #15171a;
      --ink: #f7f6f3;
      --accent: #3db3a9;
      --accent-ink: #bdeee8;
      --saved: #e0b45a;
      --danger: #e0707c;
      --card-bg: #1c1f23;
      --border: #2c2f34;
      --text: #eceae5;
      --text-muted: #a3a7ad;
      --text-faint: #6b6f76;
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--text);
    font-family: var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px 72px; }

  header.top { margin-bottom: 20px; }
  .wordmark {
    font-family: var(--mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 600;
    margin: 0 0 6px;
  }
  h1 {
    font-size: 1.5rem;
    line-height: 1.25;
    margin: 0 0 10px;
    text-wrap: balance;
  }
  nav.views {
    display: flex;
    gap: 4px;
    font-family: var(--mono);
    font-size: 0.82rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }
  nav.views a {
    display: inline-block;
    padding: 8px 12px;
    color: var(--text-muted);
    text-decoration: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  nav.views a.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .meta-line {
    font-family: var(--mono);
    font-size: 0.78rem;
    color: var(--text-faint);
    margin: 10px 0 0;
  }

  h2.section {
    font-family: var(--mono);
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 28px 0 10px;
    font-weight: 600;
  }
  h2.section:first-of-type { margin-top: 22px; }

  ul.jobs { list-style: none; margin: 0; padding: 0; }

  li.job {
    display: flex;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: 6px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  li.job.is-saved { border-left-color: var(--saved); }
  li.job.is-removed { border-left-color: var(--danger); }

  .job-body { padding: 14px 16px; flex: 1; min-width: 0; }
  .job-title { font-weight: 600; font-size: 1rem; line-height: 1.35; }
  .job-title .star { color: var(--saved); margin-right: 4px; }
  .job-company { color: var(--text); font-size: 0.92rem; margin-top: 2px; }
  .job-meta {
    color: var(--text-muted);
    font-size: 0.82rem;
    margin-top: 6px;
    font-family: var(--mono);
  }
  .job-sources { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .tag {
    font-family: var(--mono);
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    text-decoration: none;
    white-space: nowrap;
  }
  .tag:hover { border-color: var(--accent); color: var(--accent); }

  .job-actions {
    margin-top: 12px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    font-family: var(--sans);
    font-size: 0.82rem;
    font-weight: 500;
    padding: 6px 12px;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
  .btn:hover { background: var(--border); }
  .btn-save { border-color: var(--saved); color: var(--saved); }
  .btn-remove { border-color: var(--danger); color: var(--danger); }
  .btn-restore { border-color: var(--accent); color: var(--accent); }

  .empty {
    color: var(--text-faint);
    padding: 48px 0;
    text-align: center;
    font-family: var(--mono);
    font-size: 0.85rem;
  }

  @media (max-width: 480px) {
    .wrap { padding: 16px 12px 64px; }
    h1 { font-size: 1.3rem; }
    .job-body { padding: 12px; }
  }
`;

export function renderShell({ title, activeView, bodyHtml }) {
  const views = [
    { href: "/", label: "Active", key: "active" },
    { href: "/saved", label: "Saved", key: "saved" },
    { href: "/removed", label: "Removed", key: "removed" },
  ];
  const navHtml = views
    .map(
      (v) =>
        `<a href="${v.href}"${v.key === activeView ? ' class="active"' : ""}>${v.label}</a>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLES}</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <p class="wordmark">JobScanner</p>
      <h1>NZ Tech Intern &amp; Grad Jobs</h1>
      <nav class="views">${navHtml}</nav>
    </header>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function actionForm({ key, status, returnTo, label, className }) {
  return `<form method="POST" action="/api/action" style="display:inline">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="status" value="${escapeHtml(status)}">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
    <button type="submit" class="btn ${className}">${escapeHtml(label)}</button>
  </form>`;
}

export function jobCard(g, { returnTo }) {
  const sources = g.entries
    .map((e) => `<a class="tag" href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(sourceLabel(e.source))}</a>`)
    .join("");

  let actions;
  let statusClass = "";
  if (g.status === "saved") {
    statusClass = "is-saved";
    actions =
      actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Un-save", className: "btn-restore" }) +
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove", className: "btn-remove" });
  } else if (g.status === "removed") {
    statusClass = "is-removed";
    actions = actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Restore", className: "btn-restore" });
  } else {
    actions =
      actionForm({ key: g.normalizedKey, status: "saved", returnTo, label: "Save", className: "btn-save" }) +
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove", className: "btn-remove" });
  }

  const star = g.status === "saved" ? '<span class="star">★</span>' : "";

  return `<li class="job ${statusClass}">
    <div class="job-body">
      <div class="job-title">${star}${escapeHtml(g.title)}</div>
      <div class="job-company">${escapeHtml(g.company)}</div>
      <div class="job-meta">${escapeHtml(g.location || "Location not specified")} — Posted ${formatDate(g.postedAt)}</div>
      <div class="job-sources">${sources}</div>
      <div class="job-actions">${actions}</div>
    </div>
  </li>`;
}

// Buckets groups into "New today" / "This week" / "Earlier" sections for
// the active view — freshest listings stay most visible regardless of
// which source they came from (source is a per-card tag, not a grouping
// axis; see chat for the reasoning).
export function bucketByDate(groups, now = new Date()) {
  const buckets = { "New today": [], "This week": [], Earlier: [] };
  for (const g of groups) {
    if (!g.postedAt) {
      buckets.Earlier.push(g);
      continue;
    }
    const diffDays = Math.floor((now - g.postedAt) / 86400000);
    if (diffDays <= 0) buckets["New today"].push(g);
    else if (diffDays <= 7) buckets["This week"].push(g);
    else buckets.Earlier.push(g);
  }
  return buckets;
}

export function renderJobList(groups, { returnTo }) {
  if (groups.length === 0) return `<p class="empty">Nothing here.</p>`;
  return `<ul class="jobs">${groups.map((g) => jobCard(g, { returnTo })).join("")}</ul>`;
}
