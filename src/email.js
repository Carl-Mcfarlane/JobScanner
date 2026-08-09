import { Resend } from "resend";
import { formatDate, sourceLabel, escapeHtml, sortByPostedAtDesc } from "./format.js";

const FROM = "Job Alerts <onboarding@resend.dev>";

function buildSubject(groups, isFirstRun) {
  const count = groups.length;
  const noun = count === 1 ? "listing" : "listings";
  if (isFirstRun) {
    return `Job alert setup: ${count} current NZ tech intern/grad ${noun}`;
  }
  return `${count} new NZ tech intern/grad ${noun}`;
}

function buildText(groups, isFirstRun) {
  const lines = [];
  if (isFirstRun) {
    lines.push(
      "First run — here's everything currently live that matches your filters.",
      "From now on you'll only get what's new since the last check.",
      ""
    );
  }
  for (const g of groups) {
    const sources = g.entries.map((e) => sourceLabel(e.source)).join(", ");
    lines.push(`${g.title} — ${g.company}`);
    lines.push(`  ${g.location || "Location not specified"} | Posted ${formatDate(g.postedAt)} | ${sources}`);
    for (const e of g.entries) {
      lines.push(`  ${sourceLabel(e.source)}: ${e.url}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildHtml(groups, isFirstRun) {
  const intro = isFirstRun
    ? `<p>First run — here's everything currently live that matches your filters. From now on you'll only get what's new since the last check.</p>`
    : "";

  const items = groups
    .map((g) => {
      const sources = g.entries
        .map((e) => `<a href="${escapeHtml(e.url)}">${escapeHtml(sourceLabel(e.source))}</a>`)
        .join(" · ");
      return `
        <li style="margin-bottom: 16px;">
          <div style="font-weight: 600;">${escapeHtml(g.title)}</div>
          <div>${escapeHtml(g.company)}</div>
          <div style="color: #555;">${escapeHtml(g.location || "Location not specified")} — Posted ${formatDate(g.postedAt)}</div>
          <div>${sources}</div>
        </li>`;
    })
    .join("\n");

  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 640px;">
      ${intro}
      <ul style="list-style: none; padding: 0;">
        ${items}
      </ul>
    </div>`;
}

export async function sendDigest(groups, { isFirstRun = false } = {}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY env var is not set");
  }
  if (!process.env.DIGEST_TO_EMAIL) {
    throw new Error("DIGEST_TO_EMAIL env var is not set");
  }

  const sorted = sortByPostedAtDesc(groups);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: process.env.DIGEST_TO_EMAIL,
    subject: buildSubject(sorted, isFirstRun),
    text: buildText(sorted, isFirstRun),
    html: buildHtml(sorted, isFirstRun),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
  }
}
