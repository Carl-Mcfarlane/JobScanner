import { loadGroupedListings } from "../src/listingsData.js";
import { renderShell, bucketByDate, renderJobList } from "../src/pageTemplate.js";

const SECTION_ORDER = ["New today", "This week", "Earlier"];

export default async function handler(req, res) {
  try {
    const { activeGroups, savedGroups, lastRunAt } = await loadGroupedListings();

    const lastRunText = lastRunAt
      ? new Intl.DateTimeFormat("en-NZ", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Pacific/Auckland",
        }).format(lastRunAt)
      : "never";

    const buckets = bucketByDate(activeGroups);
    const sections = SECTION_ORDER.filter((k) => buckets[k].length > 0)
      .map((k) => `<h2 class="section">${k}</h2>${renderJobList(buckets[k], { returnTo: "/" })}`)
      .join("");

    const body = `
      <p class="meta-line">${activeGroups.length} active — ${savedGroups.length} saved — last scrape ran ${lastRunText}</p>
      ${sections || `<p class="empty">Nothing here.</p>`}
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderShell({ title: "JobScanner — Active Jobs", activeView: "active", bodyHtml: body }));
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>Failed to load listings: ${err.message}</pre>`);
  }
}
