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

// The actual send time is controlled by the fixed-UTC cron schedule in
// vercel.json (Vercel Hobby plan only allows daily crons, not an
// hourly-self-gating approach that could track NZ's DST changes exactly —
// see README "Digest timing" for the tradeoff and how to switch back to
// exact 6pm NZT year-round if this project ever moves to a Pro team).
export const TIMEZONE = "Pacific/Auckland";
