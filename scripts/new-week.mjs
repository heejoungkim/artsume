import path from "node:path";
import { fileExists, issuesDir, slugify, writeJson } from "./lib/content.mjs";

const args = parseArgs(process.argv.slice(2));
const baseDate = args.date ? new Date(args.date) : new Date();
const week = args.week || isoWeekId(baseDate);
const publishedAt = toDateString(baseDate);
const classDate = toDateString(addDays(baseDate, Number(args.classOffsetDays || 7)));
const filePath = path.join(issuesDir, `${week}.json`);

if ((await fileExists(filePath)) && !args.force) {
  console.error(`${filePath} already exists. Use --force to overwrite.`);
  process.exit(1);
}

const issue = {
  id: week,
  status: "draft",
  title: args.title || `${week.toUpperCase()} Reading Brief`,
  theme: args.theme || "",
  publishedAt,
  classDate,
  editorNote: "",
  synthesis: [],
  seminarPlan: [],
  articles: [1, 2].map((number) => ({
    slug: slugify(args[`article${number}`] || `article-${number}`),
    accent: number === 1 ? "#0f766e" : "#b45309",
    source: {
      title: args[`article${number}`] || "",
      publisher: "",
      author: "",
      url: args[`url${number}`] || "",
      publishedAt: ""
    },
    sourceTextPath: "",
    tags: [],
    brief: {
      titleKorean: "",
      dek: "",
      thesis: "",
      executiveSummary: "",
      whyItMatters: "",
      critique: "",
      keyInsights: [],
      keyTerms: [],
      discussionQuestions: []
    },
    cards: []
  }))
};

await writeJson(filePath, issue);
console.log(`Created ${filePath}`);

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function isoWeekId(date) {
  const working = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = working.getUTCDay() || 7;
  working.setUTCDate(working.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(working.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((working - yearStart) / 86400000 + 1) / 7);
  return `${working.getUTCFullYear()}-w${String(week).padStart(2, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}
