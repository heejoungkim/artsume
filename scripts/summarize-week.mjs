import path from "node:path";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import {
  articleTitle,
  issuesDir,
  readJson,
  rootDir,
  slugify,
  writeJson
} from "./lib/content.mjs";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const issuePath = args.issue
  ? path.resolve(rootDir, args.issue)
  : args.week
    ? path.join(issuesDir, `${args.week}.json`)
    : "";

if (!issuePath) {
  console.error("Usage: npm run summarize -- --issue content/issues/2026-w23.json");
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL;

if (!apiKey || !model) {
  console.error("OPENAI_API_KEY and OPENAI_MODEL are required. Copy .env.example to .env and fill both values.");
  process.exit(1);
}

const issue = await readJson(issuePath);

for (const article of issue.articles ?? []) {
  if (article.brief?.thesis && !args.force) {
    console.log(`Skipping ${article.slug}; pass --force to regenerate.`);
    continue;
  }

  const sourceText = await loadArticleText(article);
  const result = await summarizeArticle(article, sourceText, { apiKey, model });

  article.slug = article.slug || slugify(result.titleKorean || article.source?.title);
  article.brief = {
    titleKorean: result.titleKorean,
    dek: result.dek,
    thesis: result.thesis,
    executiveSummary: result.executiveSummary,
    whyItMatters: result.whyItMatters,
    critique: result.critique,
    keyInsights: result.keyInsights,
    keyTerms: result.keyTerms,
    discussionQuestions: result.discussionQuestions
  };
  article.tags = result.tags;
  article.cards = result.cards;
  article.updatedAt = new Date().toISOString();

  console.log(`Summarized ${article.slug}.`);
}

if (!args.skipIssueSynthesis) {
  const synthesis = await synthesizeIssue(issue, { apiKey, model });
  issue.title = synthesis.title || issue.title;
  issue.theme = synthesis.theme || issue.theme;
  issue.editorNote = synthesis.editorNote || issue.editorNote;
  issue.synthesis = synthesis.synthesis;
  issue.seminarPlan = synthesis.seminarPlan;
}

issue.updatedAt = new Date().toISOString();
await writeJson(issuePath, issue);
console.log(`Updated ${issuePath}`);

async function loadArticleText(article) {
  if (article.sourceTextPath) {
    return readFile(path.resolve(rootDir, article.sourceTextPath), "utf8");
  }

  if (!article.source?.url) {
    throw new Error(`${article.slug || article.source?.title}: source.url or sourceTextPath is required.`);
  }

  const response = await fetch(article.source.url, {
    headers: {
      "User-Agent": "WeeklyReadingBriefBot/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${article.source.url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return extractReadableText(html).slice(0, 65000);
}

async function summarizeArticle(article, sourceText, { apiKey, model }) {
  const prompt = [
    `Original title: ${article.source?.title || article.slug}`,
    `Publisher: ${article.source?.publisher || ""}`,
    `Author: ${article.source?.author || ""}`,
    `URL: ${article.source?.url || ""}`,
    "",
    "Write a Korean professional reading brief for a graduate-level or professional seminar.",
    "Return 3 to 5 keyInsights, 2 to 5 keyTerms, 3 to 5 discussionQuestions, 2 to 5 tags, and 3 to 5 cards.",
    "Do not invent citations, data, or quotes. If the article does not support a claim, phrase it as an inference.",
    "Make the card-news copy concise but not promotional.",
    "",
    "Article text:",
    sourceText
  ].join("\n");

  return createStructuredResponse({
    apiKey,
    model,
    instructions: "You are an expert Korean editor who summarizes English articles for rigorous pre-class discussion.",
    input: prompt,
    schemaName: "article_brief",
    schema: articleBriefSchema()
  });
}

async function synthesizeIssue(issue, { apiKey, model }) {
  const input = JSON.stringify({
    issueTitle: issue.title,
    theme: issue.theme,
    publishedAt: issue.publishedAt,
    classDate: issue.classDate,
    articles: (issue.articles ?? []).map((article) => ({
      title: articleTitle(article),
      thesis: article.brief?.thesis,
      executiveSummary: article.brief?.executiveSummary,
      keyInsights: article.brief?.keyInsights,
      questions: article.brief?.discussionQuestions
    }))
  }, null, 2);

  return createStructuredResponse({
    apiKey,
    model,
    instructions: "You are a Korean seminar editor. Connect two article briefs into one weekly learning issue. Return 3 to 4 synthesis items and 3 to 5 seminarPlan items.",
    input,
    schemaName: "weekly_synthesis",
    schema: weeklySynthesisSchema()
  });
}

async function createStructuredResponse({ apiKey, model, instructions, input, schemaName, schema }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        },
        verbosity: "medium"
      },
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 8000)
    })
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${JSON.stringify(body)}`);
  }

  const outputText = body.output_text || findOutputText(body);
  if (!outputText) {
    throw new Error(`OpenAI response did not include output_text: ${JSON.stringify(body)}`);
  }

  return JSON.parse(outputText);
}

function findOutputText(body) {
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function articleBriefSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "titleKorean",
      "dek",
      "thesis",
      "executiveSummary",
      "whyItMatters",
      "critique",
      "keyInsights",
      "keyTerms",
      "discussionQuestions",
      "tags",
      "cards"
    ],
    properties: {
      titleKorean: { type: "string" },
      dek: { type: "string" },
      thesis: { type: "string" },
      executiveSummary: { type: "string" },
      whyItMatters: { type: "string" },
      critique: { type: "string" },
      keyInsights: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "detail"],
          properties: {
            label: { type: "string" },
            detail: { type: "string" }
          }
        }
      },
      keyTerms: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["term", "definition"],
          properties: {
            term: { type: "string" },
            definition: { type: "string" }
          }
        }
      },
      discussionQuestions: {
        type: "array",
        items: { type: "string" }
      },
      tags: {
        type: "array",
        items: { type: "string" }
      },
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kicker", "title", "body", "footnote"],
          properties: {
            kicker: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            footnote: { type: "string" }
          }
        }
      }
    }
  };
}

function weeklySynthesisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "theme", "editorNote", "synthesis", "seminarPlan"],
    properties: {
      title: { type: "string" },
      theme: { type: "string" },
      editorNote: { type: "string" },
      synthesis: {
        type: "array",
        items: { type: "string" }
      },
      seminarPlan: {
        type: "array",
        items: { type: "string" }
      }
    }
  };
}

function extractReadableText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function loadEnv() {
  try {
    const envPath = path.join(rootDir, ".env");
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const [key, ...rest] = trimmed.split("=");
      if (!key || process.env[key]) continue;
      process.env[key] = rest.join("=").trim();
    }
  } catch {
    // .env is optional.
  }
}

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
