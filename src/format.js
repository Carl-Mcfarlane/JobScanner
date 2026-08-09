// Small formatting helpers shared between the email digest (email.js) and
// the homepage (api/home.js), so both present listings consistently.

const SOURCE_LABELS = {
  seek: "SEEK",
  trademe: "Trade Me",
  prosple: "Prosple",
  jora: "Jora",
  glassdoor: "Glassdoor",
  indeed: "Indeed",
  linkedin: "LinkedIn",
};

export function formatDate(date) {
  if (!date) return "date unknown";
  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "short",
    timeZone: "Pacific/Auckland",
  }).format(date);
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || source;
}

export function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function sortByPostedAtDesc(groups) {
  return [...groups].sort((a, b) => {
    const aTime = a.postedAt ? a.postedAt.getTime() : 0;
    const bTime = b.postedAt ? b.postedAt.getTime() : 0;
    return bTime - aTime;
  });
}
