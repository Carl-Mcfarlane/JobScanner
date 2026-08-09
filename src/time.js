import { TIMEZONE } from "./config.js";

export function getNzDateString(date = new Date()) {
  // en-CA gives YYYY-MM-DD directly, sortable and unambiguous. Used to
  // stamp "have we already sent today's digest" — see api/cron/digest.js.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
