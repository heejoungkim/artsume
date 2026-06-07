# Artsume

Artsume은 Article Summary Room입니다. 매주 영어 원서 아티클 2편을 읽고, 수업 전 토론에 쓸 수 있는 전문 브리프와 공유용 카드 뉴스를 함께 만드는 정적 사이트입니다. 배포 대상은 GitHub Pages입니다.

## 현재 구조

- `content/issues/*.json`: 주차별 브리프 원본 데이터입니다.
- `content/paper-of-mind.json`: 4Q paper를 전문가용 요약과 대중용 카드뉴스로 정리한 데이터입니다.
- `assets/paper-of-mind/*.jpg`: Paper of Mind 카드뉴스에 쓰는 생성 이미지입니다.
- `scripts/summarize-week.mjs`: 기사 원문을 읽고 OpenAI Responses API로 전문 요약을 생성합니다.
- `scripts/build-site.mjs`: 콘텐츠 JSON을 GitHub Pages용 정적 HTML로 빌드합니다.
- `.github/workflows/pages.yml`: `main` 브랜치에 push되면 `dist`를 GitHub Pages에 배포합니다.

## Paper of Mind

상단 탭 `Paper of Mind`는 `/paper-of-mind/`에 생성됩니다. 원문 PDF는 저장소나 배포 산출물에 포함하지 않고, 각 paper마다 두 가지 버전을 제공합니다.

- 전문가용 학습 노트: 개별 paper 페이지의 다운로드 링크로 제공되는 `.md` 파일입니다.
- 대중용 카드뉴스: 개별 paper 페이지에서 읽을 수 있는 카드 형식 요약입니다.

## 주간 작업 흐름

1. 새 주차 파일을 만듭니다.

```bash
npm run new-week -- --date 2026-06-14 --title "Week 24 Reading Brief"
```

2. 생성된 `content/issues/2026-w24.json`에 기사 2개의 `source.title`, `source.url`, 필요하면 `publisher`, `author`, `tags`를 채웁니다. URL 다운로드가 곤란한 글은 원문 텍스트 파일을 따로 두고 `sourceTextPath`에 경로를 넣으면 됩니다.

3. `.env.example`을 참고해 `.env`에 API 키와 모델을 설정합니다.

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-mini
```

4. 요약을 생성합니다. 이 명령은 지정된 기사 URL을 다운로드하고 OpenAI API를 호출합니다.

```bash
npm run summarize -- --issue content/issues/2026-w24.json
```

5. 로컬에서 검증하고 빌드합니다.

```bash
npm run check
npm run serve
```

6. GitHub 저장소에 push하면 Pages 워크플로가 정적 사이트를 배포합니다.

## 콘텐츠 원칙

- 원문 전문은 공개 산출물에 저장하지 않습니다.
- 요약은 한국어로 생성하되, 원문 제목과 출처를 유지합니다.
- 카드 뉴스는 홍보성 문구가 아니라 핵심 주장, 한계, 토론 질문으로 구성합니다.
- 자동 생성 결과는 발행 전 사람이 사실관계와 뉘앙스를 확인해야 합니다.

## GitHub Pages 설정

GitHub 저장소에서 Pages source를 GitHub Actions로 설정해야 합니다. 워크플로는 GitHub 공식 Pages 문서의 custom workflow 구조를 따릅니다.

공개 주소가 정해지면 `content/site.json`의 `baseUrl`을 예를 들어 `https://USER.github.io/REPOSITORY` 형식으로 채우면 RSS, canonical URL, 공유 이미지 URL이 절대 경로로 생성됩니다.
