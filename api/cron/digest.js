import { runDigest } from "../../src/runDigest.js";
import { getState, saveState } from "../../src/db.js";
import { getNzDateString } from "../../src/time.js";

// Vercel Cron hits this once a day (see vercel.json — the Hobby plan only
// allows daily crons, so this can't self-gate hourly against NZ local time
// like a Pro-plan setup could; see README "Digest timing" for the tradeoff).
// The lastDigestDate check below is just a safety net against duplicate
// sends if Vercel ever retries/double-fires the same day.
export default async function handler(req, res) {
  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expectedAuth && req.headers["authorization"] !== expectedAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const force = req.query?.force === "true";
  const today = getNzDateString();
  const state = await getState();
  if (state.lastDigestDate === today && !force) {
    res.status(200).json({ skipped: true, reason: "already ran today", lastDigestDate: state.lastDigestDate });
    return;
  }

  try {
    const result = await runDigest({ log: console.log });
    await saveState({ lastDigestDate: today });
    res.status(200).json({
      ok: true,
      isFirstRun: result.isFirstRun,
      totalFetched: result.totalFetched,
      matchingCount: result.matchingCount,
      newCount: result.newCount,
      digestEntries: result.groups.length,
      emailSent: result.emailSent,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
