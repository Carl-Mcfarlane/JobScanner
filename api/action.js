import { getListingActionsCollection } from "../src/db.js";

const VALID_STATUSES = ["saved", "removed", "clear"];

// Backs the Save/Remove/Restore buttons on the homepage. Plain HTML form
// POST (no client-side JS) — redirects back to wherever the form was
// submitted from so it works as a normal page reload.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { key, status, returnTo } = req.body || {};
  if (!key || !VALID_STATUSES.includes(status)) {
    res.status(400).send("Bad request: missing/invalid key or status");
    return;
  }

  const actions = await getListingActionsCollection();
  if (status === "clear") {
    await actions.deleteOne({ _id: key });
  } else {
    await actions.updateOne(
      { _id: key },
      { $set: { status, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/";
  res.writeHead(303, { Location: safeReturnTo });
  res.end();
}
