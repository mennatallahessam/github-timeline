# GitHub Timeline

Turn any GitHub user's public repositories into a polished, shareable chronological timeline.

![GitHub Timeline screenshot placeholder](./docs/screenshot-placeholder.png)

## Features

- **Chronological repository history**: Enter any GitHub username to generate a vertical timeline of their public repositories, complete with creation dates, descriptions, primary language chips, star counts, fork/archive badges, and external homepage links.
- **Full pagination**: Automatically paginates through the GitHub REST API (`per_page=100`) until all public repositories are loaded—supporting prolific accounts with hundreds or thousands of repositories.
- **Interactive filtering & sorting**: Instantly toggle between **Newest first** and **Oldest first**, and filter forks or archived repositories without refetching.
- **Language breakdown & click-to-filter**: A multi-segment proportional bar and interactive language chips powered by GitHub Linguist colors. Click any language chip (in the breakdown bar or on a repository card) to filter the timeline and year summary to that language.
- **Repositories-per-year summary**: A responsive CSS bar chart summarizing annual output that updates with active filters. Clicking any year smooth-scrolls and moves focus to that year's marker on the timeline, paired with an accessible data table for screen readers and print.
- **Shareable deep links**: Syncs the active username to `?user={username}` via `history.replaceState`, updates the document title and meta description, and provides a one-click **Copy link** button with clipboard fallback.
- **Light, dark, and print themes**: Automatically follows `prefers-color-scheme` with a persistent manual override in `localStorage`, plus a dedicated `@media print` stylesheet for saving clean PDFs.
- **Resilient & accessible**: Client-side username validation, `AbortController` race-condition protection, 10-minute in-memory + `sessionStorage` caching, WCAG 2.1 AA contrast, semantic landmarks, polite `aria-live` status updates, and `prefers-reduced-motion` support.

## Tech Stack

- **Framework**: React 18 + TypeScript (strict mode)
- **Build tool**: Vite 5
- **Styling**: Plain CSS with CSS custom properties (`tokens.css`, `base.css`, `components.css`, `timeline.css`, `print.css`)
- **Data source**: Native `fetch` against GitHub REST API v3 (`https://api.github.com`)
- **Testing**: Vitest + React Testing Library + `@vitest/coverage-v8`
- **Code quality**: ESLint 9 (strict TypeScript config, zero warnings) + Prettier

## Setup & Run Instructions

### Prerequisites

- Node.js 18+ and npm 9+

### Install & run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview

# Run the test suite
npm test

# Run tests with coverage on src/utils and src/api
npm run coverage

# Run ESLint (zero warnings allowed)
npm run lint
```

## Design Decisions & Trade-offs

1. **Pure-function username validation (no lookbehind regex)**: GitHub usernames allow 1–39 ASCII alphanumerics or single hyphens, and cannot start or end with a hyphen. Validation is implemented as a character loop in `src/utils/validateUsername.ts` rather than a regex with lookbehinds so older Safari engines never fail to parse the bundle.
2. **UTC date formatting and grouping**: Both `formatDate` and `getYear` format timestamps in UTC. This guarantees that a repository created near midnight UTC never displays a December 31 date inside a January 1 year group (or vice versa) depending on the viewer's local timezone.
3. **Two-tier caching (`Map` + `sessionStorage`)**: Lookups are cached in memory and mirrored to `sessionStorage` with a 10-minute TTL (`src/api/cache.ts`). Every entry read back from `sessionStorage` is re-validated through `parseUser` and `parseRepo` so corrupted or manually edited storage can never break rendering.
4. **Incremental rendering + `content-visibility: auto`**: Timelines render in batches of 60 cards with a **Show more** button, and lists exceeding 100 items enable `content-visibility: auto` to keep layout and paint costs low. Selecting a year in the summary bar chart automatically expands the visible slice to include that year before scrolling.
5. **Build-time Content Security Policy**: Vite's development server injects inline preamble scripts for React Fast Refresh, which a strict `script-src 'self'` blocks. A tiny Vite plugin in `vite.config.ts` injects the restrictive `<meta http-equiv="Content-Security-Policy">` tag during `vite build` so production builds remain locked down while `npm run dev` works seamlessly.
6. **Automatic contrast for language chips**: GitHub Linguist colors range from pale yellow (`#f1e05a` for JavaScript) to deep navy (`#000080` for Lua). `getReadableTextColor` computes WCAG relative luminance for each chip's background color and picks near-black (`#111111`) or white (`#ffffff`) to guarantee readable text.

## Known Limitations

- **Unauthenticated GitHub API rate limit (60 requests/hour)**: Because the app runs entirely in the browser with no backend or token, GitHub limits requests to 60 per hour per IP address. Calling `GET /users/{username}` plus `N` pages of `GET /users/{username}/repos` consumes `1 + N` requests on a cache miss. When the limit is reached, the UI displays the exact local reset time from the `x-ratelimit-reset` header.
- **Static Open Graph tags**: Social crawlers do not execute client-side JavaScript when scraping shared `?user=...` URLs, so `index.html` ships static Open Graph defaults while `document.title` and `<meta name="description">` update dynamically in the browser.
- **Up to 10,000 repositories per user**: `fetchAllRepos` caps pagination at 100 pages (`10,000` repositories) as a safeguard against infinite loops if an upstream proxy ever returns malformed pagination headers.

## Deployment

The production build outputs static files to `dist/` with a relative base path (`./`), making it deployable to any static host.

### GitHub Pages

1. Run `npm run build`.
2. Push the `dist/` folder to your `gh-pages` branch (or use `actions/deploy-pages` in GitHub Actions with `path: dist`).

### Netlify

1. Connect the repository in Netlify.
2. Set **Build command** to `npm run build` and **Publish directory** to `dist`.

### Vercel

1. Import the project in Vercel (Vite is auto-detected).
2. Confirm **Build Command** is `npm run build` and **Output Directory** is `dist`, then deploy.

### Render

This repo includes a [`render.yaml`](./render.yaml) Blueprint for one-click static site deployment:

1. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint** (or **Static Site**).
2. Connect your GitHub repository (`mennatallahessam/github-timeline`).
3. If using **Static Site** manually, set:
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Click **Create Static Site** (or **Apply** for Blueprint). Render will build and deploy automatically on every push to `master`.
