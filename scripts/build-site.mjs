import path from "node:path";
import { cp } from "node:fs/promises";
import {
  absoluteHref,
  articleHref,
  articleTitle,
  distDir,
  escapeHtml,
  formatDate,
  issueHref,
  loadIssues,
  loadPaperOfMind,
  loadSite,
  resetDir,
  rootDir,
  writeText
} from "./lib/content.mjs";

const site = await loadSite();
const issues = await loadIssues();
const paperOfMind = await loadPaperOfMind();

await resetDir(distDir);
await copyProjectAssets();
await writeText(path.join(distDir, "assets/styles.css"), styles());
await writeText(path.join(distDir, "index.html"), renderHome(site, issues, paperOfMind));

for (const issue of issues) {
  await writeText(path.join(distDir, "issues", issue.id, "index.html"), renderIssue(site, issue, issues));
  await writeText(path.join(distDir, "assets", `${issue.id}.svg`), issueCoverSvg(site, issue));
  for (const article of issue.articles) {
    await writeText(
      path.join(distDir, "articles", article.slug, "index.html"),
      renderArticle(site, issue, article, issues)
    );
  }
}

await writeText(path.join(distDir, "paper-of-mind", "index.html"), renderPaperIndex(site, paperOfMind));
for (const paper of paperOfMind.papers) {
  await writeText(path.join(distDir, "paper-of-mind", paper.slug, "index.html"), renderPaperPage(site, paperOfMind, paper));
  await writeText(
    path.join(distDir, "downloads", "paper-of-mind", `${paper.slug}.md`),
    renderExpertDownload(paperOfMind, paper)
  );
}

await writeText(path.join(distDir, "feed.json"), JSON.stringify(buildFeed(site, issues), null, 2));
await writeText(path.join(distDir, "rss.xml"), buildRss(site, issues));

async function copyProjectAssets() {
  await cp(path.join(rootDir, "assets"), path.join(distDir, "assets"), {
    recursive: true,
    force: true
  }).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
}

function renderHome(site, issues, paperOfMind) {
  const latest = issues[0];
  const currentPath = "/";
  return page({
    site,
    title: site.title,
    description: site.subtitle,
    pathName: currentPath,
    body: `
      <main class="home-shell">
        ${latest ? renderLatestIssue(latest, currentPath, site) : renderEmptyState()}
        <section class="editorial-band" aria-labelledby="paper-room-title">
          <div class="section-heading">
            <p class="eyebrow">Reading room</p>
            <h2 id="paper-room-title">${escapeHtml(paperOfMind.title)}</h2>
          </div>
          <p>${escapeHtml(paperOfMind.description)}</p>
          <a class="text-link" href="${href(currentPath, "/paper-of-mind/")}">Paper of Mind 열기</a>
        </section>
        <section class="issue-index" aria-labelledby="issue-index-title">
          <div class="section-heading">
            <p class="eyebrow">Archive</p>
            <h2 id="issue-index-title">주간 브리프</h2>
          </div>
          <div class="issue-list">
            ${issues.map((issue) => issueListItem(issue, currentPath)).join("")}
          </div>
        </section>
      </main>
    `
  });
}

function renderLatestIssue(issue, currentPath, site) {
  return `
    <section class="brief-hero" aria-labelledby="latest-title">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(site.title)} / Article Summary Room</p>
        <h1 id="latest-title">${escapeHtml(issue.title)}</h1>
        <p class="collection-note">${escapeHtml(site.subtitle || "")}</p>
        <p class="hero-subtitle">${escapeHtml(issue.theme || "")}</p>
        <dl class="issue-meta">
          <div><dt>Published</dt><dd>${escapeHtml(formatDate(issue.publishedAt))}</dd></div>
          <div><dt>Class</dt><dd>${escapeHtml(formatDate(issue.classDate))}</dd></div>
          <div><dt>Articles</dt><dd>${issue.articles.length}</dd></div>
        </dl>
        <a class="primary-link" href="${href(currentPath, issueHref(issue))}">브리프 열기</a>
      </div>
      <div class="hero-visual" aria-label="이번 호 카드 미리보기">
        ${issue.articles.map((article, index) => previewCard(article, index)).join("")}
      </div>
    </section>
    <section class="synthesis-band" aria-label="이번 호 종합">
      ${(issue.synthesis ?? []).slice(0, 3).map((item, index) => `
        <article>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <p>${escapeHtml(item)}</p>
        </article>
      `).join("")}
    </section>
  `;
}

function renderEmptyState() {
  return `
    <main class="empty-state">
      <p class="eyebrow">No issues</p>
      <h1>아직 발행된 브리프가 없습니다.</h1>
    </main>
  `;
}

function issueListItem(issue, currentPath) {
  return `
    <article class="issue-row">
      <div>
        <p class="row-meta">${escapeHtml(formatDate(issue.publishedAt))} / ${escapeHtml(issue.status)}</p>
        <h3><a href="${href(currentPath, issueHref(issue))}">${escapeHtml(issue.title)}</a></h3>
        <p>${escapeHtml(issue.theme || "")}</p>
      </div>
      <div class="row-articles">
        ${issue.articles.map((article) => `<span>${escapeHtml(articleTitle(article))}</span>`).join("")}
      </div>
    </article>
  `;
}

function previewCard(article, index) {
  const brief = article.brief ?? {};
  return `
    <article class="preview-card" style="--accent:${escapeHtml(article.accent)}">
      <span class="preview-number">${String(index + 1).padStart(2, "0")}</span>
      <h2>${escapeHtml(articleTitle(article))}</h2>
      <p>${escapeHtml(brief.dek || brief.thesis || "")}</p>
      <div class="tag-line">${(article.tags ?? []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `;
}

function renderIssue(site, issue, issues) {
  const currentPath = issueHref(issue);
  return page({
    site,
    title: `${issue.title} | ${site.title}`,
    description: issue.theme,
    pathName: currentPath,
    ogImage: `/assets/${issue.id}.svg`,
    body: `
      <main class="issue-page">
        <nav class="breadcrumb"><a href="${href(currentPath, "/")}">Issues</a><span>${escapeHtml(issue.id)}</span></nav>
        <header class="issue-header">
          <p class="eyebrow">Weekly brief</p>
          <h1>${escapeHtml(issue.title)}</h1>
          <p>${escapeHtml(issue.theme || "")}</p>
          <dl class="issue-meta">
            <div><dt>Published</dt><dd>${escapeHtml(formatDate(issue.publishedAt))}</dd></div>
            <div><dt>Class</dt><dd>${escapeHtml(formatDate(issue.classDate))}</dd></div>
            <div><dt>Status</dt><dd>${escapeHtml(issue.status)}</dd></div>
          </dl>
        </header>
        ${issue.editorNote ? `<aside class="editor-note">${escapeHtml(issue.editorNote)}</aside>` : ""}
        <section class="issue-split">
          <div>
            <div class="section-heading">
              <p class="eyebrow">Synthesis</p>
              <h2>이번 주 핵심 연결</h2>
            </div>
            <ol class="numbered-list">
              ${(issue.synthesis ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ol>
          </div>
          <div>
            <div class="section-heading">
              <p class="eyebrow">Seminar</p>
              <h2>수업 전 체크포인트</h2>
            </div>
            <ol class="numbered-list">
              ${(issue.seminarPlan ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ol>
          </div>
        </section>
        <section class="article-grid" aria-label="아티클 브리프">
          ${issue.articles.map((article) => articleSummaryCard(article, currentPath)).join("")}
        </section>
        <section class="card-news-section" aria-labelledby="cards-title">
          <div class="section-heading">
            <p class="eyebrow">Card news</p>
            <h2 id="cards-title">공유용 카드</h2>
          </div>
          <div class="card-deck">
            ${issue.articles.map((article) => renderCardDeck(article)).join("")}
          </div>
        </section>
        ${renderIssuePager(issue, issues, currentPath)}
      </main>
    `
  });
}

function articleSummaryCard(article, currentPath) {
  const brief = article.brief ?? {};
  return `
    <article class="article-summary" style="--accent:${escapeHtml(article.accent)}">
      <div class="source-line">${escapeHtml(article.source?.publisher || "Source")} / ${escapeHtml(article.source?.author || "")}</div>
      <h2><a href="${href(currentPath, articleHref(article))}">${escapeHtml(articleTitle(article))}</a></h2>
      <p class="dek">${escapeHtml(brief.dek || "")}</p>
      <p>${escapeHtml(brief.executiveSummary || brief.thesis || "")}</p>
      <div class="tag-line">${(article.tags ?? []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </article>
  `;
}

function renderCardDeck(article) {
  return `
    <div class="deck-group" style="--accent:${escapeHtml(article.accent)}">
      <h3>${escapeHtml(articleTitle(article))}</h3>
      <div class="deck-scroll">
        ${(article.cards ?? []).map((card, index) => `
          <article class="news-card">
            <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
            <p class="card-kicker">${escapeHtml(card.kicker || "")}</p>
            <h4>${escapeHtml(card.title || "")}</h4>
            <p>${escapeHtml(card.body || "")}</p>
            <small>${escapeHtml(card.footnote || "")}</small>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function renderArticle(site, issue, article, issues) {
  const brief = article.brief ?? {};
  const currentPath = articleHref(article);
  return page({
    site,
    title: `${articleTitle(article)} | ${site.title}`,
    description: brief.dek || brief.thesis,
    pathName: currentPath,
    body: `
      <main class="article-page">
        <nav class="breadcrumb"><a href="${href(currentPath, "/")}">Issues</a><a href="${href(currentPath, issueHref(issue))}">${escapeHtml(issue.id)}</a><span>${escapeHtml(article.slug)}</span></nav>
        <article class="long-brief" style="--accent:${escapeHtml(article.accent)}">
          <header>
            <p class="source-line">${escapeHtml(article.source?.publisher || "Source")} / ${escapeHtml(article.source?.author || "")}</p>
            <h1>${escapeHtml(articleTitle(article))}</h1>
            <p class="dek">${escapeHtml(brief.dek || "")}</p>
            ${article.source?.url ? `<a class="source-link" href="${escapeHtml(article.source.url)}" rel="noreferrer">원문 보기</a>` : ""}
          </header>
          <section>
            <h2>핵심 주장</h2>
            <p>${escapeHtml(brief.thesis || "")}</p>
          </section>
          <section>
            <h2>요약</h2>
            <p>${escapeHtml(brief.executiveSummary || "")}</p>
          </section>
          <section>
            <h2>왜 중요한가</h2>
            <p>${escapeHtml(brief.whyItMatters || "")}</p>
          </section>
          <section>
            <h2>주요 논점</h2>
            <div class="insight-list">
              ${(brief.keyInsights ?? []).map((item) => `
                <article>
                  <h3>${escapeHtml(item.label || "")}</h3>
                  <p>${escapeHtml(item.detail || "")}</p>
                </article>
              `).join("")}
            </div>
          </section>
          <section>
            <h2>비판적 검토</h2>
            <p>${escapeHtml(brief.critique || "")}</p>
          </section>
          <section>
            <h2>핵심 용어</h2>
            <dl class="term-list">
              ${(brief.keyTerms ?? []).map((term) => `
                <div>
                  <dt>${escapeHtml(term.term || "")}</dt>
                  <dd>${escapeHtml(term.definition || "")}</dd>
                </div>
              `).join("")}
            </dl>
          </section>
          <section>
            <h2>수업 질문</h2>
            <ol class="numbered-list">
              ${(brief.discussionQuestions ?? []).map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
            </ol>
          </section>
          <section class="card-news-section compact">
            <div class="section-heading">
              <p class="eyebrow">Card news</p>
              <h2>카드 요약</h2>
            </div>
            ${renderCardDeck(article)}
          </section>
        </article>
        ${renderIssuePager(issue, issues, currentPath)}
      </main>
    `
  });
}

function renderPaperIndex(site, paperOfMind) {
  const currentPath = "/paper-of-mind/";
  return page({
    site,
    title: `${paperOfMind.title} | ${site.title}`,
    description: paperOfMind.subtitle,
    pathName: currentPath,
    body: `
      <main class="paper-room">
        <nav class="breadcrumb"><a href="${href(currentPath, "/")}">Issues</a><span>${escapeHtml(paperOfMind.title)}</span></nav>
        <header class="paper-room-hero">
          <p class="eyebrow">Article Summary Room</p>
          <h1>${escapeHtml(paperOfMind.title)}</h1>
          <p>${escapeHtml(paperOfMind.subtitle)}</p>
          <aside>${escapeHtml(paperOfMind.description)}</aside>
        </header>
        <section class="paper-session-grid" aria-label="Paper sessions">
          ${paperOfMind.sessions.map((session) => renderSessionBlock(session, paperOfMind, currentPath)).join("")}
        </section>
      </main>
    `
  });
}

function renderSessionBlock(session, paperOfMind, currentPath) {
  const papers = paperOfMind.papers.filter((paper) => paper.session === session.id);
  return `
    <section class="paper-session">
      <img src="${href(currentPath, session.image)}" alt="${escapeHtml(session.title)} illustration">
      <div>
        <p class="eyebrow">${escapeHtml(session.label)}</p>
        <h2>${escapeHtml(session.title)}</h2>
        <p>${escapeHtml(session.theme)}</p>
      </div>
      <div class="paper-list">
        ${papers.map((paper) => `
          <article class="paper-card" style="--accent:${escapeHtml(paper.accent)}">
            <p class="source-line">${escapeHtml(paper.authorYear)}</p>
            <h3><a href="${href(currentPath, paperHref(paper))}">${escapeHtml(paper.shortTitle)}</a></h3>
            <p>${escapeHtml(paper.focus)}</p>
            <div class="paper-actions">
              <a href="${href(currentPath, paperHref(paper))}">카드뉴스 보기</a>
              <a href="${href(currentPath, paperDownloadHref(paper))}">전문가용 요약 다운로드</a>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderPaperPage(site, paperOfMind, paper) {
  const currentPath = paperHref(paper);
  const session = paperOfMind.sessions.find((item) => item.id === paper.session) ?? {};
  return page({
    site,
    title: `${paper.shortTitle} | ${paperOfMind.title} | ${site.title}`,
    description: paper.public?.dek || paper.focus,
    pathName: currentPath,
    ogImage: session.image,
    body: `
      <main class="paper-page">
        <nav class="breadcrumb"><a href="${href(currentPath, "/")}">Issues</a><a href="${href(currentPath, "/paper-of-mind/")}">${escapeHtml(paperOfMind.title)}</a><span>${escapeHtml(paper.shortTitle)}</span></nav>
        <article class="paper-detail" style="--accent:${escapeHtml(paper.accent)}">
          <header class="paper-detail-header">
            <div>
              <p class="eyebrow">${escapeHtml(session.label || "")} / ${escapeHtml(session.title || "")}</p>
              <h1>${escapeHtml(paper.shortTitle)}</h1>
              <p class="dek">${escapeHtml(paper.public?.dek || paper.focus)}</p>
              <dl class="issue-meta">
                <div><dt>Paper</dt><dd>${escapeHtml(paper.authorYear)}</dd></div>
                <div><dt>Mode</dt><dd>Study + Card News</dd></div>
                <div><dt>Source</dt><dd>${escapeHtml(paper.sourceScope)}</dd></div>
              </dl>
              <a class="primary-link" href="${href(currentPath, paperDownloadHref(paper))}" download>전문가용 요약 다운로드</a>
            </div>
            <img src="${href(currentPath, session.image || "")}" alt="${escapeHtml(session.title || paper.shortTitle)} illustration">
          </header>

          <section class="copyright-note">
            <p>원문 PDF는 재게시하지 않습니다. 이 페이지는 수업과 공개 공유를 위한 변형 요약이며, 직접 인용 없이 논지와 임상적 함의를 재구성했습니다.</p>
          </section>

          <section class="paper-detail-grid">
            <div class="study-panel">
              <p class="eyebrow">Expert study note</p>
              <h2>핵심 논지</h2>
              <p>${escapeHtml(paper.expert.thesis)}</p>
              ${paper.expert.map.map((block) => `
                <section>
                  <h3>${escapeHtml(block.heading)}</h3>
                  <ul>
                    ${block.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
                  </ul>
                </section>
              `).join("")}
              <section>
                <h3>임상적 사용</h3>
                <p>${escapeHtml(paper.expert.clinicalUse)}</p>
              </section>
              <section>
                <h3>주의점</h3>
                <p>${escapeHtml(paper.expert.cautions)}</p>
              </section>
            </div>

            <aside class="study-questions">
              <p class="eyebrow">Seminar questions</p>
              <ol class="numbered-list">
                ${paper.expert.studyQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}
              </ol>
            </aside>
          </section>

          <section class="public-card-news" aria-labelledby="public-cards-title">
            <div class="section-heading">
              <p class="eyebrow">Public card news</p>
              <h2 id="public-cards-title">대중용 카드뉴스</h2>
            </div>
            <div class="public-card-grid">
              ${paper.public.cards.map((card, index) => `
                <article class="public-card">
                  <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
                  <p class="card-kicker">${escapeHtml(card.kicker)}</p>
                  <h3>${escapeHtml(card.title)}</h3>
                  <p>${escapeHtml(card.body)}</p>
                  <div class="diagram-chip">${escapeHtml(card.diagram)}</div>
                </article>
              `).join("")}
            </div>
          </section>
        </article>
      </main>
    `
  });
}

function renderExpertDownload(paperOfMind, paper) {
  const session = paperOfMind.sessions.find((item) => item.id === paper.session) ?? {};
  return [
    `# ${paper.shortTitle}`,
    "",
    `- Paper: ${paper.title}`,
    `- Author / year: ${paper.authorYear}`,
    `- Collection: ${paperOfMind.title}`,
    `- Session: ${session.label || ""} ${session.title || ""}`.trim(),
    "",
    "## 저작권 메모",
    "",
    "원문 PDF를 재게시하지 않습니다. 이 파일은 학습과 토론을 위한 변형 요약이며, 직접 인용 없이 논지와 임상적 함의를 재구성한 자료입니다.",
    "",
    "## 핵심 논지",
    "",
    paper.expert.thesis,
    "",
    "## 상세 학습 노트",
    "",
    paper.expert.map.map((block) => [
      `### ${block.heading}`,
      "",
      ...block.points.map((point) => `- ${point}`),
      ""
    ].join("\n")).join("\n"),
    "## 임상적 사용",
    "",
    paper.expert.clinicalUse,
    "",
    "## 주의점",
    "",
    paper.expert.cautions,
    "",
    "## 수업 질문",
    "",
    ...paper.expert.studyQuestions.map((question, index) => `${index + 1}. ${question}`),
    ""
  ].join("\n");
}

function paperHref(paper) {
  return `/paper-of-mind/${paper.slug}/`;
}

function paperDownloadHref(paper) {
  return `/downloads/paper-of-mind/${paper.slug}.md`;
}

function renderIssuePager(current, issues, currentPath) {
  const index = issues.findIndex((issue) => issue.id === current.id);
  const newer = issues[index - 1];
  const older = issues[index + 1];
  return `
    <nav class="issue-pager" aria-label="Issue navigation">
      ${older ? `<a href="${href(currentPath, issueHref(older))}">이전 호: ${escapeHtml(older.title)}</a>` : "<span></span>"}
      ${newer ? `<a href="${href(currentPath, issueHref(newer))}">다음 호: ${escapeHtml(newer.title)}</a>` : "<span></span>"}
    </nav>
  `;
}

function page({ site, title, description = "", pathName = "/", ogImage = "", body }) {
  const hasPublicBaseUrl = Boolean(site.baseUrl);
  const canonical = hasPublicBaseUrl ? absoluteHref(pathName, site) : "";
  const imageUrl = hasPublicBaseUrl && ogImage ? absoluteHref(ogImage, site) : "";
  return `<!doctype html>
<html lang="${escapeHtml(site.language || "ko")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description || site.subtitle || "")}">
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description || site.subtitle || "")}">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ""}
  <link rel="stylesheet" href="${href(pathName, "/assets/styles.css")}">
</head>
<body>
  <header class="site-header">
    <a class="site-mark" href="${href(pathName, "/")}">${escapeHtml(site.title)}</a>
    <nav>
      ${(site.navigation ?? []).map((item) => `<a href="${href(pathName, item.href)}">${escapeHtml(item.label)}</a>`).join("")}
    </nav>
  </header>
  ${body}
  <footer class="site-footer">
    <p>${escapeHtml(site.subtitle || "")}</p>
    <p>Built for GitHub Pages.</p>
  </footer>
</body>
</html>`;
}

function href(fromPath, toPath) {
  return escapeHtml(relativeHref(fromPath, toPath));
}

function relativeHref(fromPath, toPath) {
  if (/^https?:\/\//.test(toPath)) return toPath;
  const from = fromPath.endsWith("/")
    ? fromPath.slice(1, -1)
    : path.posix.dirname(fromPath).replace(/^\//, "");
  const target = toPath === "/" ? "" : toPath.replace(/^\//, "").replace(/\/$/, "");
  const raw = path.posix.relative(from, target);
  if (!raw) return "./";
  if (toPath.endsWith("/") && !raw.endsWith("/")) return `${raw}/`;
  return raw;
}

function buildFeed(site, issues) {
  return {
    title: site.title,
    subtitle: site.subtitle,
    updatedAt: new Date().toISOString(),
    issues: issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      href: absoluteHref(issueHref(issue), site),
      publishedAt: issue.publishedAt,
      classDate: issue.classDate,
      articles: issue.articles.map((article) => ({
        title: articleTitle(article),
        href: absoluteHref(articleHref(article), site),
        source: article.source
      }))
    }))
  };
}

function buildRss(site, issues) {
  const siteUrl = (site.baseUrl || "").replace(/\/$/, "");
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(site.title)}</title>
    <link>${escapeHtml(siteUrl || "/")}</link>
    <description>${escapeHtml(site.subtitle || "")}</description>
    ${issues.map((issue) => `
    <item>
      <title>${escapeHtml(issue.title)}</title>
      <link>${escapeHtml(absoluteHref(issueHref(issue), site))}</link>
      <guid>${escapeHtml(absoluteHref(issueHref(issue), site))}</guid>
      <pubDate>${new Date(issue.publishedAt).toUTCString()}</pubDate>
      <description>${escapeHtml(issue.theme || "")}</description>
    </item>`).join("")}
  </channel>
</rss>`;
}

function issueCoverSvg(site, issue) {
  const title = escapeHtml(issue.title);
  const theme = escapeHtml(issue.theme || "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${title}">
  <rect width="1200" height="630" fill="#f4f1e8"/>
  <rect x="56" y="56" width="1092" height="518" fill="#101820"/>
  <rect x="96" y="100" width="7" height="430" fill="#0f766e"/>
  <text x="130" y="145" fill="#d7a646" font-family="Arial, sans-serif" font-size="28">${escapeHtml(site.title)}</text>
  <foreignObject x="130" y="185" width="930" height="230">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #fff; font-size: 56px; line-height: 1.12; font-weight: 700;">${title}</div>
  </foreignObject>
  <foreignObject x="130" y="435" width="900" height="90">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; color: #dce3e8; font-size: 27px; line-height: 1.35;">${theme}</div>
  </foreignObject>
</svg>`;
}

function styles() {
  return `
:root {
  color-scheme: light;
  --paper: #f7f4ec;
  --paper-2: #fffdf7;
  --ink: #141414;
  --muted: #5d6570;
  --line: #d8d1bf;
  --navy: #101820;
  --teal: #0f766e;
  --amber: #b45309;
  --red: #9f3434;
  --blue: #295f98;
  --shadow: 0 18px 50px rgba(20, 20, 20, 0.12);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}

a {
  color: inherit;
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.22em;
}

.site-header,
.site-footer,
.home-shell,
.issue-page,
.article-page,
.paper-room,
.paper-page {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.site-header {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.site-mark {
  font-weight: 800;
  text-decoration: none;
}

.site-header nav {
  display: flex;
  gap: 18px;
  color: var(--muted);
  font-size: 0.95rem;
}

.brief-hero {
  min-height: calc(100vh - 120px);
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 1.05fr);
  align-items: center;
  gap: 38px;
  padding: 44px 0 56px;
}

.hero-copy h1,
.issue-header h1,
.long-brief h1 {
  margin: 0;
  max-width: 980px;
  font-size: clamp(2.6rem, 7vw, 5.8rem);
  line-height: 1.02;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.hero-subtitle,
.collection-note,
.issue-header > p,
.dek {
  color: var(--muted);
  font-size: 1.16rem;
  max-width: 720px;
}

.collection-note {
  color: var(--ink);
  font-weight: 800;
}

.eyebrow,
.source-line,
.row-meta,
.card-kicker {
  margin: 0 0 10px;
  color: var(--amber);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
}

.issue-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 28px 0;
}

.issue-meta div {
  min-width: 118px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.issue-meta dt {
  color: var(--muted);
  font-size: 0.76rem;
  text-transform: uppercase;
}

.issue-meta dd {
  margin: 0;
  font-weight: 800;
}

.primary-link,
.source-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  border: 1px solid var(--ink);
  padding: 0 18px;
  background: var(--ink);
  color: white;
  font-weight: 800;
  text-decoration: none;
}

.hero-visual {
  display: grid;
  gap: 16px;
}

.preview-card,
.article-summary,
.news-card,
.issue-row,
.editor-note,
.insight-list article,
.term-list div {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-2);
}

.preview-card {
  min-height: 240px;
  padding: 26px;
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}

.preview-card::before,
.article-summary::before,
.news-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 7px;
  background: var(--accent);
}

.preview-card h2 {
  margin: 36px 0 12px;
  font-size: 1.8rem;
  line-height: 1.16;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.preview-card p,
.article-summary p {
  color: #3f4650;
}

.preview-number,
.card-index {
  position: absolute;
  right: 22px;
  top: 18px;
  color: var(--accent);
  font-size: 2.8rem;
  font-weight: 900;
  line-height: 1;
}

.tag-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.tag-line span {
  border: 1px solid color-mix(in srgb, var(--accent), white 55%);
  border-radius: 999px;
  padding: 4px 9px;
  color: color-mix(in srgb, var(--accent), black 20%);
  font-size: 0.78rem;
  font-weight: 800;
}

.synthesis-band {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  margin: 0 0 72px;
  background: var(--line);
  border: 1px solid var(--line);
}

.synthesis-band article {
  background: var(--navy);
  color: #f8fafc;
  min-height: 160px;
  padding: 24px;
}

.synthesis-band span {
  color: #d7a646;
  font-weight: 900;
}

.section-heading {
  margin: 0 0 24px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.8rem;
}

.issue-index,
.card-news-section,
.issue-split,
.article-grid,
.long-brief section,
.paper-session-grid,
.paper-detail-grid,
.public-card-news,
.editorial-band {
  margin: 66px 0;
}

.issue-list,
.article-grid {
  display: grid;
  gap: 16px;
}

.issue-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.5fr);
  gap: 24px;
  padding: 24px;
}

.issue-row h3 {
  margin: 0 0 8px;
  font-size: 1.35rem;
}

.row-articles {
  display: grid;
  align-content: center;
  gap: 8px;
  color: var(--muted);
  font-weight: 700;
}

.breadcrumb {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 28px 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.breadcrumb > * + *::before {
  content: "/";
  margin-right: 10px;
  color: var(--line);
}

.issue-header {
  padding: 40px 0 16px;
}

.editor-note {
  padding: 20px 24px;
  border-left: 7px solid var(--blue);
  color: #343a43;
}

.issue-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 36px;
}

.numbered-list {
  margin: 0;
  padding-left: 1.3rem;
}

.numbered-list li + li {
  margin-top: 12px;
}

.article-summary {
  position: relative;
  padding: 28px 28px 28px 34px;
}

.article-summary h2 {
  margin: 0 0 10px;
  font-size: 1.75rem;
  line-height: 1.18;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.card-deck {
  display: grid;
  gap: 28px;
}

.deck-group h3 {
  margin: 0 0 14px;
}

.deck-scroll {
  display: grid;
  grid-template-columns: repeat(3, minmax(240px, 1fr));
  gap: 16px;
}

.news-card {
  position: relative;
  min-height: 330px;
  padding: 30px 24px 22px 32px;
  display: flex;
  flex-direction: column;
}

.news-card h4 {
  margin: 52px 0 16px;
  font-size: 1.75rem;
  line-height: 1.14;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.news-card p {
  margin: 0;
  font-size: 1rem;
}

.news-card small {
  margin-top: auto;
  color: var(--muted);
  font-weight: 700;
}

.long-brief {
  max-width: 860px;
  margin: 0 auto;
}

.long-brief header {
  border-bottom: 1px solid var(--line);
  padding: 32px 0 42px;
}

.long-brief h1 {
  font-size: clamp(2.4rem, 6vw, 4.6rem);
}

.long-brief h2 {
  margin: 0 0 12px;
  font-size: 1.65rem;
}

.long-brief p {
  font-size: 1.05rem;
}

.insight-list {
  display: grid;
  gap: 12px;
}

.insight-list article,
.term-list div {
  padding: 18px 20px;
}

.insight-list h3 {
  margin: 0 0 6px;
}

.term-list {
  display: grid;
  gap: 12px;
}

.term-list dt {
  font-weight: 900;
}

.term-list dd {
  margin: 6px 0 0;
  color: #444b54;
}

.issue-pager {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin: 72px 0 40px;
  border-top: 1px solid var(--line);
  padding-top: 22px;
  font-weight: 800;
}

.editorial-band {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 38px 0;
}

.editorial-band p {
  max-width: 760px;
  color: var(--muted);
  font-size: 1.12rem;
}

.text-link {
  display: inline-flex;
  margin-top: 8px;
  font-weight: 900;
}

.paper-room-hero {
  min-height: 56vh;
  display: grid;
  align-content: center;
  gap: 18px;
  padding: 40px 0 28px;
  border-bottom: 1px solid var(--line);
}

.paper-room-hero h1,
.paper-detail-header h1 {
  margin: 0;
  max-width: 960px;
  font-size: clamp(3rem, 8vw, 7rem);
  line-height: 1;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.paper-room-hero p {
  max-width: 740px;
  color: var(--muted);
  font-size: 1.2rem;
}

.paper-room-hero aside,
.copyright-note {
  max-width: 860px;
  border-left: 7px solid var(--teal);
  background: var(--paper-2);
  padding: 18px 22px;
  color: #374151;
}

.paper-session {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(220px, 0.5fr) minmax(0, 1.1fr);
  gap: 26px;
  align-items: start;
  padding: 34px 0;
  border-bottom: 1px solid var(--line);
}

.paper-session img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
}

.paper-session h2 {
  margin: 0 0 10px;
  font-size: 2rem;
  line-height: 1.1;
}

.paper-session p {
  color: var(--muted);
}

.paper-list {
  display: grid;
  gap: 14px;
}

.paper-card {
  position: relative;
  border-top: 4px solid var(--accent);
  padding: 18px 0 0;
}

.paper-card h3 {
  margin: 0 0 8px;
  font-size: 1.28rem;
  line-height: 1.2;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.paper-card p {
  margin: 0 0 12px;
  color: #3f4650;
}

.paper-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  font-weight: 900;
  font-size: 0.92rem;
}

.paper-detail-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.85fr);
  gap: 36px;
  align-items: center;
  padding: 28px 0 52px;
}

.paper-detail-header img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: var(--shadow);
}

.copyright-note {
  margin: 0 0 42px;
}

.copyright-note p {
  margin: 0;
}

.paper-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 0.42fr);
  gap: 36px;
  align-items: start;
}

.study-panel {
  border-top: 1px solid var(--line);
}

.study-panel > section,
.study-panel > p,
.study-panel > h2,
.study-panel > .eyebrow {
  max-width: 780px;
}

.study-panel h2 {
  margin: 18px 0 8px;
  font-size: 2rem;
}

.study-panel h3 {
  margin: 26px 0 8px;
  font-size: 1.25rem;
}

.study-panel ul {
  margin: 0;
  padding-left: 1.2rem;
}

.study-panel li + li {
  margin-top: 8px;
}

.study-questions {
  position: sticky;
  top: 24px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-2);
  padding: 22px;
}

.public-card-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 1fr));
  gap: 16px;
}

.public-card {
  position: relative;
  min-height: 360px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-2);
  padding: 30px 24px 22px;
  display: flex;
  flex-direction: column;
}

.public-card::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 7px;
  background: var(--accent);
}

.public-card h3 {
  margin: 54px 0 14px;
  font-size: 1.55rem;
  line-height: 1.16;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.public-card p {
  margin: 0;
}

.diagram-chip {
  margin-top: auto;
  border-top: 1px solid var(--line);
  padding-top: 14px;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.site-footer {
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding: 32px 0 48px;
  color: var(--muted);
}

.empty-state {
  min-height: 60vh;
  display: grid;
  place-content: center;
}

@media (max-width: 900px) {
  .brief-hero,
  .issue-split,
  .issue-row,
  .paper-session,
  .paper-detail-header,
  .paper-detail-grid {
    grid-template-columns: 1fr;
  }

  .brief-hero {
    min-height: auto;
  }

  .synthesis-band,
  .deck-scroll,
  .public-card-grid {
    grid-template-columns: 1fr;
  }

  .hero-copy h1,
  .issue-header h1,
  .long-brief h1,
  .paper-room-hero h1,
  .paper-detail-header h1 {
    font-size: 2.1rem;
    line-height: 1.14;
  }

  .study-questions {
    position: static;
  }
}

@media (max-width: 560px) {
  .site-header,
  .site-footer,
  .home-shell,
  .issue-page,
  .article-page {
    width: min(100% - 24px, 1180px);
  }

  .site-header,
  .site-footer,
  .issue-pager {
    flex-direction: column;
    align-items: flex-start;
  }

  .preview-card,
  .article-summary,
  .news-card {
    padding-right: 18px;
  }
}

@media print {
  body {
    background: white;
  }

  .site-header,
  .site-footer,
  .breadcrumb,
  .issue-pager,
  .source-link {
    display: none;
  }

  .news-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;
}
