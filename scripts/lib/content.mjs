import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const contentDir = path.join(rootDir, "content");
export const issuesDir = path.join(contentDir, "issues");
export const distDir = path.join(rootDir, "dist");

export async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

export async function resetDir(dirPath) {
  await rm(dirPath, { recursive: true, force: true });
  await ensureDir(dirPath);
}

export async function writeText(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadSite() {
  return readJson(path.join(contentDir, "site.json"));
}

export async function loadIssues() {
  const names = await readdir(issuesDir);
  const files = names.filter((name) => name.endsWith(".json") && !name.startsWith("_"));
  const issues = [];
  for (const file of files) {
    const issue = await readJson(path.join(issuesDir, file));
    issues.push(normalizeIssue(issue));
  }
  return issues.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

export function normalizeIssue(issue) {
  return {
    status: "draft",
    editorNote: "",
    synthesis: [],
    seminarPlan: [],
    articles: [],
    ...issue,
    articles: (issue.articles ?? []).map(normalizeArticle)
  };
}

export function normalizeArticle(article) {
  return {
    accent: "#0f766e",
    source: {},
    tags: [],
    brief: {},
    cards: [],
    ...article,
    source: article.source ?? {},
    tags: article.tags ?? [],
    brief: article.brief ?? {},
    cards: article.cards ?? []
  };
}

export function slugify(value) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "untitled";
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function absoluteHref(href, site = {}) {
  if (!href) return "";
  if (/^https?:\/\//.test(href)) return href;
  const base = (site.baseUrl ?? "").replace(/\/$/, "");
  const normalized = href.startsWith("/") ? href : `/${href}`;
  return base ? `${base}${normalized}` : normalized;
}

export function formatDate(value, locale = "ko-KR") {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function articleTitle(article) {
  return article.brief?.titleKorean || article.source?.title || article.slug || "Untitled article";
}

export function issueHref(issue) {
  return `/issues/${issue.id}/`;
}

export function articleHref(article) {
  return `/articles/${article.slug}/`;
}
