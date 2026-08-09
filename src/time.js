import { TIMEZONE } from "./config.js";

// Vercel Cron schedules are fixed UTC and don't track daylight saving, but
// NZ shifts between NZST (UTC+12) and NZDT (UTC+13) twice a year. Instead
// of hardcoding a UTC cron time that drifts an hour off-target for half the
// year, the cron function runs hourly and uses these helpers to check
// "is it actually 6pm in Auckland right now" — which Intl's timezone
// database keeps correct across DST changes automatically.

export function getNzHour(date = new Date()) {
  const hourStr = new Intl.DateTimeFormat("en-NZ", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
  }).format(date);
  return parseInt(hourStr, 10) % 24;
}

export function getNzDateString(date = new Date()) {
  // en-CA gives YYYY-MM-DD directly, sortable and unambiguous.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
