# Job Finder App

Personal tool: scrapes NZ tech intern/grad job listings, filters by location
and keyword, dedupes across sources, and emails a daily digest at ~4:30pm NZT.
A simple read-only homepage (`/`, served by `api/home.js`) also lists
everything currently in the database, for browsing anytime rather than
waiting for the email.

Currently live: **SEEK, SEEK Grad (nz.gradconnection.com), Prosple**. Sources
get added one at a time, reusing this same pipeline — see `src/config.js`
`SOURCES`. Status of the rest:

- **Trade Me** — deferred. Official Jobs Search API requires a registered
  OAuth app (consumer key/secret + an access token generated for your own
  account) — needs manual setup on trademe.co.nz that only the account
  owner can do.
- **Glassdoor** — built (`src/sources/glassdoor.js`), page-1-only per
  robots.txt, but not enabled: Glassdoor 403s Node's `fetch` specifically
  even with headers that work fine via `curl` — looks like TLS/HTTP client
  fingerprinting, not a missing-header issue.
- **Jora** — not built. `robots.txt` blanket-disallows `/` for any
  unnamed user-agent.
- **Indeed** — not built. `robots.txt` disallows `/jobs` and `/viewjob`
  outright — the exact paths needed.
- **LinkedIn** — not built. `robots.txt` opens with an explicit "automated
  access is strictly prohibited without permission" notice and disallows
  `/jobs-guest/`; combined with LinkedIn's history of legal action against
  scrapers, this one's being skipped rather than attempted.

## How it works

```
src/sources/*.js  -->  matching.js (location+keyword filter)  -->  dedupe.js
   (scrape)                                                     (cross-source grouping)
                                                                        |
                                                                        v
                                                          db.js (diff vs already-seen)
                                                                        |
                                                                        v
                                                              email.js (Resend digest)
```

Orchestrated by `src/runDigest.js`. Triggered either by:
- `api/cron/digest.js` — the Vercel Cron target (deployed)
- `scripts/run-local.js` — for testing locally without deploying

### Digest timing

Vercel Cron schedules are fixed UTC and don't track daylight saving. NZ
alternates between NZST (UTC+12) and NZDT (UTC+13), so a single fixed-UTC
cron expression drifts an hour off-target for part of the year.

The ideal fix is an hourly cron that self-gates on "is it actually 4:30pm
in Pacific/Auckland right now" (computed via `Intl`, which knows about
DST) — but that requires **Vercel Pro**, since Hobby-plan projects are
limited to daily cron jobs. The `carlms-projects` team this is deployed
under is on Hobby, so `vercel.json` currently uses a single daily cron at
a fixed UTC time (`30 3 * * *` = 3:30am UTC), chosen to land on 4:30pm
during NZDT (the longer of the two — about 7 months a year) and 3:30pm
during NZST (~5 months a year).

If this project ever moves to a Pro team, swap back to the DST-accurate
version: schedule `"30 * * * *"` (hourly, on the half-hour) in
`vercel.json`, and in `api/cron/digest.js` add a check that skips unless
`getNzHour() === 16` (re-add `getNzHour` to `src/time.js` — it's a few
lines, see git history) before running the pipeline.

Either way, `api/cron/digest.js` also checks Mongo for whether today's
digest already went out, so a retried/duplicate cron trigger within the
same day won't double-send.

### First run vs. subsequent runs

On the very first run ever (`meta.hasRunBefore` is false in Mongo), every
currently-matching listing is treated as "new" and included in the digest —
a backfill of everything currently live, so nothing already posted is
missed. Every run after that only includes listings not already in the
`listings` collection.

## Setup

### 1. MongoDB Atlas (free tier)

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a new project, then build a free **M0** cluster (pick a region close
   to NZ, e.g. Sydney).
3. Under **Database Access**, create a database user with a password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) —
   Vercel's serverless functions don't have fixed IPs.
5. Click **Connect** on your cluster → **Drivers** → copy the connection
   string. It looks like:
   `mongodb+srv://<db_username>:<db_password>@<cluster-host>/?appName=<app>`
6. Add a database name to the path so listings land somewhere predictable,
   e.g. `.../Jobhunt?retryWrites=true&w=majority&appName=<app>`.
7. Put that full string in `.env` as `MONGODB_URI` (see `.env.example`).
   **Never commit this to a README or anywhere else that isn't gitignored —
   `.env` is the only place credentials should live.**

No manual collection/index setup needed — `src/db.js` creates the indexes
it needs on first use.

### 2. Resend (email)

Chosen over Nodemailer+SMTP for this project because:
- No SMTP server/app-password wrangling (Gmail SMTP requires enabling app
  passwords and fighting its sending limits/spam heuristics for automated mail).
- A generous free tier (3,000 emails/month) — miles more than 1/day.
- The sandbox sender (`onboarding@resend.dev`) works with **zero domain
  setup**, which matters here since this is a single-recipient personal tool,
  not something sending on your own domain to third parties.

Tradeoff: the sandbox sender can only send **to the email address on your
Resend account** (not arbitrary recipients). Since this tool only ever
emails you, that's not actually a limitation here — sign up for Resend with
`carltmcfarlane@gmail.com` (the same address it'll send to) and it works
immediately. If you ever want a custom "from" domain, you'd verify a domain
in Resend and change `FROM` in `src/email.js` — no other code changes needed.

1. Go to https://resend.com/signup and create an account with
   `carltmcfarlane@gmail.com`.
2. Go to https://resend.com/api-keys and create an API key.
3. Put it in `.env` as `RESEND_API_KEY`.

### 3. Local `.env`

```
cp .env.example .env
```

Fill in `MONGODB_URI` and `RESEND_API_KEY` from the steps above.
`DIGEST_TO_EMAIL` is already set to `carltmcfarlane@gmail.com`.

### 4. Install & test locally

```
npm install

# Dry run: scrapes + filters + prints what the digest WOULD contain.
# Does not write to Mongo or send an email.
npm run digest:dry

# Real run: same pipeline, but writes to Mongo and sends the actual email.
# Safe to run repeatedly — it's idempotent per source-listing (upsert by
# source+sourceId), so re-running won't create duplicate DB entries or
# re-notify you about listings you've already seen (except on a true
# first-ever run, which backfills everything once).
npm run digest
```

### 5. Deploy to Vercel

```
vercel link      # link this folder to a Vercel project
vercel env add MONGODB_URI production
vercel env add RESEND_API_KEY production
vercel env add DIGEST_TO_EMAIL production
vercel env add CRON_SECRET production   # any long random string — also add to .env locally
vercel deploy --prod
```

Vercel Cron (configured in `vercel.json`) will start hitting
`/api/cron/digest` once a day automatically once deployed — no separate
cron setup needed. See "Digest timing" above for why it's a fixed daily
UTC time rather than exact 4:30pm NZT year-round.

**Function timeout**: `vercel.json` sets `maxDuration: 60` for the cron
function. SEEK alone takes well under that (a handful of requests with a
1.5s respectful delay between each). Revisit this number upward as more
sources are added — check it against your Vercel plan's max
(Pro supports up to 300s standard, more with Fluid Compute).

### 6. Verify the cron is protected

`api/cron/digest.js` checks the `Authorization: Bearer <CRON_SECRET>`
header. Vercel automatically attaches this header (using your `CRON_SECRET`
env var) on its own cron invocations, so nothing extra to wire up — but it
does mean the endpoint is protected against random internet traffic
triggering your scraper/email on demand.

## Configuration

All tunable filters live in `src/config.js`, no code changes needed elsewhere:

- `LOCATIONS` — substrings matched (case-insensitive) against each listing's
  location label. Currently `["Auckland", "Hamilton", "Bay of Plenty"]`.
  Note: "Hamilton" matches only listings labelled with "Hamilton" specifically
  (e.g. "Hamilton East, Waikato"), not all of the wider Waikato region.
- `KEYWORDS` — substrings matched (case-insensitive) against each listing's
  title. Currently `["intern", "internship", "graduate", "grad", "software
  engineer", "summer"]`. Note this is deliberately broad per spec (any ONE
  keyword qualifies) — e.g. "Graduate Legal Counsel" will match on "graduate"
  even though it's not a tech role. Tighten `KEYWORDS` if that's too noisy.
- `SOURCES` — flip `enabled: true` once a source's scraper is built and
  validated end-to-end.
- `DIGEST_HOUR_NZT` — the NZ local hour (24h) the digest fires.

## Respectful scraping notes (SEEK)

- Honors `robots.txt`: only ever fetches the search results page
  (`/jobs?keywords=...`, explicitly allowed), never `*/job/` detail pages,
  `/graphql`, or `/api/jobsearch/` (all explicitly disallowed) — everything
  needed (title, company, location, posted date, job id) is already embedded
  in the search page's JSON, so there's no need to touch those paths.
  See `src/sources/seek.js` for the specifics.
- 1.5s delay between every request (page-to-page and query-to-query).
- Runs once/day, not polling.
- Capped at 4 pages per seed query (`MAX_PAGES_PER_QUERY` in `seek.js`).

## What's next

1. ~~SEEK~~ — done, validated end-to-end.
2. ~~SEEK Grad~~ — done, validated end-to-end.
3. ~~Prosple~~ — done, validated end-to-end.
4. Glassdoor — scraper built, blocked on the Node `fetch` TLS-fingerprint
   403 described above.
5. Trade Me — deferred, needs the account owner to register a Trade Me
   developer app.
6. Jora, Indeed, LinkedIn — not planned; all three disallow the paths a
   compliant scraper would need (see above).
