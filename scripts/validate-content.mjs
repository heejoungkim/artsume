import { loadIssues, loadSite } from "./lib/content.mjs";

const site = await loadSite();
const issues = await loadIssues();
const errors = [];

if (!site.title) errors.push("content/site.json: title is required.");
if (!issues.length) errors.push("content/issues: at least one issue JSON file is required.");

for (const issue of issues) {
  requireField(issue, "id", `content/issues/${issue.id || "unknown"}.json`);
  requireField(issue, "title", `content/issues/${issue.id}.json`);
  requireField(issue, "publishedAt", `content/issues/${issue.id}.json`);
  requireField(issue, "classDate", `content/issues/${issue.id}.json`);

  if (!Array.isArray(issue.articles) || issue.articles.length !== 2) {
    errors.push(`${issue.id}: exactly two articles are expected for the weekly cadence.`);
  }

  for (const article of issue.articles ?? []) {
    const label = `${issue.id}/${article.slug || "unknown"}`;
    requireField(article, "slug", label);
    if (!article.source?.title) errors.push(`${label}: source.title is required.`);
    if (!article.brief?.titleKorean && !article.brief?.thesis) {
      errors.push(`${label}: brief.titleKorean or brief.thesis is required.`);
    }
    if (!Array.isArray(article.cards) || article.cards.length < 1) {
      errors.push(`${label}: at least one card is required.`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${issues.length} issue(s) for ${site.title}.`);

function requireField(object, field, label) {
  if (!object?.[field]) errors.push(`${label}: ${field} is required.`);
}
