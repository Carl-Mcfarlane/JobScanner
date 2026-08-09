import { loadGroupedListings } from "../src/listingsData.js";
import { renderShell, renderJobList } from "../src/pageTemplate.js";

export default async function handler(req, res) {
  try {
    const { removedGroups } = await loadGroupedListings();

    const body = `
      <p class="meta-line">${removedGroups.length} removed</p>
      ${renderJobList(removedGroups, { returnTo: "/removed" })}
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderShell({ title: "JobScanner — Removed Jobs", activeView: "removed", bodyHtml: body }));
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>Failed to load removed listings: ${err.message}</pre>`);
  }
}
