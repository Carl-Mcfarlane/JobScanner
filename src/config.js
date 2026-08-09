// All the tunable filters for the job alert tool live here.
// Nothing below should require touching scraper/pipeline code to adjust.

// Case-insensitive substrings matched against each listing's normalized
// location label (e.g. "New Lynn, Auckland", "Rotorua, Bay of Plenty").
// A listing passes if ANY of these substrings appear in its location label.
export const LOCATIONS = ["Auckland", "Hamilton", "Bay of Plenty"];

// Keyword matching is two-part: a listing passes only if its title
// contains BOTH a seniority/entry-level signal AND a tech-domain signal.
// This is what lets "Junior Data Analyst" and "DevOps Graduate" match
// without also reopening the gate to "Senior Software Engineer" (has a
// tech signal, no entry signal) or "Graduate Mechanical Engineer" (has an
// entry signal, but "engineer" alone isn't tech-specific — see note below).
// Matching is whole-word (via matching.js), so "grad" won't match inside
// "upgrade" and "IT" won't match inside "recruitment".

export const KEYWORDS_ENTRY = [
  "intern",
  "internship",
  "graduate",
  "grad",
  "graduate programme",
  "graduate program",
  "junior",
  "entry-level",
  "entry level",
  "cadetship",
  "cadet",
  "trainee",
  "summer",
];

// Includes bare "engineer"/"engineering" — a deliberate tradeoff (see
// chat): without it, company-context-dependent titles like "Growth
// Engineering Intern" (at an edtech company) or "Engineering Practice
// Internship" (at a bank's tech division) never match, since the title
// alone doesn't say "software". The cost is some mechanical/civil/
// electrical engineering internships getting through too — accepted as
// the better tradeoff for a personal alert tool (skim past a few
// irrelevant ones vs. silently missing real tech roles).
export const KEYWORDS_TECH = [
  "software",
  "developer",
  "dev",
  "engineer",
  "engineering",
  "IT",
  "ai",
  "data",
  "cloud",
  "web",
  "full stack",
  "full-stack",
  "frontend",
  "front-end",
  "backend",
  "back-end",
  "devops",
  "qa",
  "systems analyst",
  "sysadmin",
  "administrator",
  "admin",
  "help desk",
  "service desk",
  "desktop support",
  "technical support",
  "network",
  "infrastructure",
  "cybersecurity",
  "cyber security",
  "cyber",
  "security",
  "database",
  "programmer",
  "programming",
  "machine learning",
  "ml",
  "artificial intelligence",
  "mobile app",
  "ux",
  "ui",
  "computer science",
  "information technology",
  "technology",
  "tech",
  "site reliability",
  "automation",
  "embedded",
];

// Deliberately NOT included: bare "architect" (NZ has plenty of literal
// building-architecture graduate programmes — "Graduate Architect" at a
// firm like Warren and Mahoney is not a tech role), and "code"/"coding"
// (too many non-tech collisions — "dress code", "post code", "building
// code" — for the recall gain they'd add over "developer"/"programming").

// Sources are enabled one at a time as they're built and validated
// end-to-end (see BUILD APPROACH in project notes). Flip `enabled: true`
// once a source's pipeline is proven.
export const SOURCES = [
  { id: "seek", enabled: true },
  { id: "seekgrad", enabled: true }, // nz.gradconnection.com — SEEK's rebrand of GradConnection
  { id: "trademe", enabled: false }, // deferred — Jobs Search API needs a registered OAuth app
  { id: "prosple", enabled: true },
  // Glassdoor: page-1 search URLs are robots.txt-compliant and the scraper
  // is built (src/sources/glassdoor.js), but Glassdoor 403s Node's fetch
  // specifically — same headers work fine via curl, so this looks like
  // TLS/HTTP client fingerprinting rather than a missing-header issue.
  // Not enabling until/unless that's resolved — see chat for details.
  { id: "glassdoor", enabled: false },
  // Jora: robots.txt blanket-disallows "/" for any unnamed user-agent — not built.
  { id: "jora", enabled: false },
  // Indeed: robots.txt disallows /jobs and /viewjob outright — not built.
  { id: "indeed", enabled: false },
  { id: "linkedin", enabled: false },
];

// The actual send time is controlled by the fixed-UTC cron schedule in
// vercel.json (Vercel Hobby plan only allows daily crons, not an
// hourly-self-gating approach that could track NZ's DST changes exactly —
// see README "Digest timing" for the tradeoff and how to switch back to
// exact 6pm NZT year-round if this project ever moves to a Pro team).
export const TIMEZONE = "Pacific/Auckland";
