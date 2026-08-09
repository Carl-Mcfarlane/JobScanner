import { runDigest } from "../../src/runDigest.js";
import { getState, saveState } from "../../src/db.js";
import { getNzHour, getNzDateString } from "../../src/time.js";
import { DIGEST_HOUR_NZT } from "../../src/config.js";

// Vercel Cron hits this every hour (see vercel.json). It only actually
// scrapes + emails once, at DIGEST_HOUR_NZT NZ local time — see time.js for
// why this is hourly-gated rather than a single fixed-UTC cron expression.
export default async function handler(req, res) {
  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expectedAuth && req.headers["authorization"] !== expectedAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const force = req.query?.force === "true";
  const nzHour = getNzHour();

  if (nzHour !== DIGEST_HOUR_NZT && !force) {
    res.status(200).json({ skipped: true, reason: `not digest hour (currently ${nzHour}:00 NZT)` });
    return;
  }

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
