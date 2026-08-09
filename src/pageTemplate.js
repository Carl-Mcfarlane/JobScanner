import { formatDate, sourceLabel, escapeHtml } from "./format.js";
import { LOCATIONS } from "./config.js";

// Shared design system for the homepage / saved / removed views.
//
// Design: clean and minimal — near-monochrome paper/ink ground, a single
// restrained accent for links/actions, one sans-serif typeface throughout
// (hierarchy comes from size/weight/spacing, not multiple type families).
// Flat list with hairline dividers rather than boxed cards; tags and
// actions read as plain text, not bordered pills/buttons.
//
// Filtering (search + source/location toggles) is plain vanilla JS at
// the bottom of the page — filters the already-rendered list client-side,
// no framework, no page reload. Save/Remove/Restore stay regular HTML
// form POSTs (untouched by the filter JS).

const STYLES = `
  :root {
    --paper: #fafaf8;
    --ink: #1c1c1a;
    --accent: #2451c4;
    --saved: #9c7a1f;
    --danger: #a13333;
    --border: #e6e4de;
    --text: #1c1c1a;
    --text-muted: #6b6b64;
    --text-faint: #96958c;
    --chip-bg: #f0efe9;
    --chip-bg-active: #2451c4;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #171715;
      --ink: #ededE8;
      --accent: #6f93ee;
      --saved: #d4a72c;
      --danger: #d97070;
      --border: #2c2c28;
      --text: #ededE8;
      --text-muted: #9a9a92;
      --text-faint: #6b6b64;
      --chip-bg: #232320;
      --chip-bg-active: #6f93ee;
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
  a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .wrap { max-width: 660px; margin: 0 auto; padding: 32px 20px 80px; }

  header.top { margin-bottom: 24px; }
  .wordmark {
    font-size: 0.8rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
    font-weight: 600;
    margin: 0 0 8px;
  }
  h1 {
    font-size: 1.6rem;
    font-weight: 600;
    line-height: 1.25;
    margin: 0 0 16px;
    text-wrap: balance;
  }
  nav.views {
    display: flex;
    gap: 20px;
    font-size: 0.88rem;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }
  nav.views a {
    display: inline-block;
    padding: 0 0 10px;
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
    font-size: 0.85rem;
    color: var(--text-faint);
    margin: 16px 0 0;
  }

  .filters { margin: 20px 0 4px; display: flex; flex-direction: column; gap: 10px; }
  .search-input {
    width: 100%;
    font-family: var(--sans);
    font-size: 0.95rem;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--paper);
    color: var(--text);
  }
  .search-input::placeholder { color: var(--text-faint); }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    font-family: var(--sans);
    font-size: 0.78rem;
    padding: 4px 11px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: var(--chip-bg);
    color: var(--text-muted);
    cursor: pointer;
  }
  .chip:hover { color: var(--text); }
  .chip.active { background: var(--chip-bg-active); color: #fff; }

  h2.section {
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-faint);
    font-weight: 600;
    margin: 32px 0 4px;
  }
  h2.section:first-of-type { margin-top: 24px; }

  ul.jobs { list-style: none; margin: 0; padding: 0; }

  li.job {
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
  }
  li.job.is-saved .job-title::before { content: "★ "; color: var(--saved); }

  .job-title { font-weight: 600; font-size: 1rem; line-height: 1.4; }
  .job-company { color: var(--text); font-size: 0.92rem; margin-top: 2px; }
  .job-meta {
    color: var(--text-muted);
    font-size: 0.82rem;
    margin-top: 6px;
  }
  .job-sources { margin-top: 6px; font-size: 0.8rem; color: var(--text-faint); }
  .job-sources a { color: var(--text-faint); text-decoration: none; }
  .job-sources a:hover { color: var(--accent); text-decoration: underline; }
  .job-sources .sep { margin: 0 5px; }

  .job-actions { margin-top: 8px; display: flex; gap: 14px; }
  .link-btn {
    font-family: var(--sans);
    font-size: 0.82rem;
    font-weight: 500;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .link-save { color: var(--saved); }
  .link-remove { color: var(--danger); }
  .link-restore { color: var(--accent); }

  .empty {
    color: var(--text-faint);
    padding: 56px 0;
    text-align: center;
    font-size: 0.9rem;
  }

  @media (max-width: 480px) {
    .wrap { padding: 24px 16px 72px; }
    h1 { font-size: 1.35rem; }
  }
`;

const FILTER_SCRIPT = `
(function () {
  var search = document.getElementById("job-search");
  var chips = document.querySelectorAll(".chip");
  var items = document.querySelectorAll("li.job");
  var sections = document.querySelectorAll("h2.section");
  var activeSources = new Set();
  var activeLocations = new Set();

  function apply() {
    var q = (search && search.value || "").trim().toLowerCase();
    items.forEach(function (li) {
      var matchesQuery = !q || li.dataset.title.includes(q) || li.dataset.company.includes(q);
      var srcs = li.dataset.source.split(" ");
      var matchesSource = activeSources.size === 0 || srcs.some(function (s) { return activeSources.has(s); });
      var matchesLocation = activeLocations.size === 0 ||
        Array.from(activeLocations).some(function (loc) { return li.dataset.location.includes(loc); });
      li.style.display = (matchesQuery && matchesSource && matchesLocation) ? "" : "none";
    });
    sections.forEach(function (h2) {
      var next = h2.nextElementSibling;
      var anyVisible = next && Array.prototype.some.call(next.children, function (li) { return li.style.display !== "none"; });
      h2.style.display = anyVisible ? "" : "none";
      if (next) next.style.display = anyVisible ? "" : "none";
    });
  }

  if (search) search.addEventListener("input", apply);
  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      var set = chip.dataset.filterType === "source" ? activeSources : activeLocations;
      var val = chip.dataset.filterValue;
      if (set.has(val)) { set.delete(val); chip.classList.remove("active"); }
      else { set.add(val); chip.classList.add("active"); }
      apply();
    });
  });
})();
`;

export function renderShell({ title, activeView, bodyHtml, filterBarHtml = "" }) {
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
    ${filterBarHtml}
    ${bodyHtml}
  </div>
  <script>${FILTER_SCRIPT}</script>
</body>
</html>`;
}

// Renders the search box + source/location toggle chips. `sources` is the
// distinct list of source ids actually present in `groups` (no point
// showing a filter chip for a source with zero listings).
export function renderFilterBar(groups) {
  const sources = [...new Set(groups.flatMap((g) => g.entries.map((e) => e.source)))].sort();
  const sourceChips = sources
    .map((s) => `<button type="button" class="chip" data-filter-type="source" data-filter-value="${escapeHtml(s)}">${escapeHtml(sourceLabel(s))}</button>`)
    .join("");
  const locationChips = LOCATIONS
    .map((loc) => `<button type="button" class="chip" data-filter-type="location" data-filter-value="${escapeHtml(loc.toLowerCase())}">${escapeHtml(loc)}</button>`)
    .join("");

  return `<div class="filters">
    <input type="text" id="job-search" class="search-input" placeholder="Search title or company&hellip;" autocomplete="off">
    <div class="chip-row">${sourceChips}</div>
    <div class="chip-row">${locationChips}</div>
  </div>`;
}

function actionForm({ key, status, returnTo, label, className }) {
  return `<form method="POST" action="/api/action" style="display:inline">
    <input type="hidden" name="key" value="${escapeHtml(key)}">
    <input type="hidden" name="status" value="${escapeHtml(status)}">
    <input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">
    <button type="submit" class="link-btn ${className}">${escapeHtml(label)}</button>
  </form>`;
}

export function jobCard(g, { returnTo }) {
  const sources = g.entries
    .map((e) => `<a href="${escapeHtml(e.url)}" target="_blank" rel="noopener">${escapeHtml(sourceLabel(e.source))}</a>`)
    .join('<span class="sep">·</span>');

  let actions;
  let statusClass = "";
  if (g.status === "saved") {
    statusClass = "is-saved";
    actions =
      actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Un-save", className: "link-restore" }) +
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove", className: "link-remove" });
  } else if (g.status === "removed") {
    statusClass = "is-removed";
    actions = actionForm({ key: g.normalizedKey, status: "clear", returnTo, label: "Restore", className: "link-restore" });
  } else {
    actions =
      actionForm({ key: g.normalizedKey, status: "saved", returnTo, label: "Save", className: "link-save" }) +
      actionForm({ key: g.normalizedKey, status: "removed", returnTo, label: "Remove", className: "link-remove" });
  }

  const dataSource = g.entries.map((e) => e.source).join(" ");
  const dataTitle = escapeHtml((g.title || "").toLowerCase());
  const dataCompany = escapeHtml((g.company || "").toLowerCase());
  const dataLocation = escapeHtml((g.location || "").toLowerCase());

  const salaryPart = g.salary ? ` — ${escapeHtml(g.salary)}` : "";

  return `<li class="job ${statusClass}" data-title="${dataTitle}" data-company="${dataCompany}" data-source="${escapeHtml(dataSource)}" data-location="${dataLocation}">
    <div class="job-title">${escapeHtml(g.title)}</div>
    <div class="job-company">${escapeHtml(g.company)}</div>
    <div class="job-meta">${escapeHtml(g.location || "Location not specified")} — Posted ${formatDate(g.postedAt)}${salaryPart}</div>
    <div class="job-sources">${sources}</div>
    <div class="job-actions">${actions}</div>
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
