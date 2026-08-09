import { loadGroupedListings } from "../src/listingsData.js";
import { renderShell, renderJobList } from "../src/pageTemplate.js";

export default async function handler(req, res) {
  try {
    const { savedGroups } = await loadGroupedListings();

    const body = `
      <p class="meta-line">${savedGroups.length} saved</p>
      ${renderJobList(savedGroups, { returnTo: "/saved" })}
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(renderShell({ title: "JobScanner — Saved Jobs", activeView: "saved", bodyHtml: body }));
  } catch (err) {
    console.error(err);
    res.status(500).send(`<pre>Failed to load saved listings: ${err.message}</pre>`);
  }
}
