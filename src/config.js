// All the tunable filters for the job alert tool live here.
// Nothing below should require touching scraper/pipeline code to adjust.

// Case-insensitive substrings matched against each listing's normalized
// location label (e.g. "New Lynn, Auckland", "Rotorua, Bay of Plenty").
// A listing passes if ANY of these substrings appear in its location label.
export const LOCATIONS = ["Auckland", "Hamilton", "Bay of Plenty"];

// Case-insensitive substrings matched against each listing's title.
// A listing passes if ANY of these substrings appear in its title.
export const KEYWORDS = [
  "intern",
  "internship",
  "graduate",
  "grad",
  "software engineer",
  "summer",
];

// Sources are enabled one at a time as they're built and validated
// end-to-end (see BUILD APPROACH in project notes). Flip `enabled: true`
// once a source's pipeline is proven.
export const SOURCES = [
  { id: "seek", enabled: true },
  { id: "trademe", enabled: false },
  { id: "prosple", enabled: false },
  { id: "jora", enabled: false },
  { id: "glassdoor", enabled: false },
  { id: "indeed", enabled: false },
  { id: "linkedin", enabled: false },
];

// Hour (24h, NZ local time) the digest should fire. The cron function runs
// hourly and only actually executes the pipeline when it's this hour in
// Pacific/Auckland — this makes the send time immune to NZDT/NZST changes,
// since a fixed-UTC Vercel cron expression can't track daylight saving.
export const DIGEST_HOUR_NZT = 18;

export const TIMEZONE = "Pacific/Auckland";
