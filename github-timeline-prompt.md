# Task: Build "GitHub Timeline", a portfolio-grade web app

You are a senior front-end engineer. Build a production-quality single-page web application called **GitHub Timeline**. The user enters a GitHub username, clicks **Generate**, and sees a beautiful, shareable vertical timeline of that user's **public** repositories. Each timeline entry shows the repo name, its creation date, and its description. The result must be polished enough to send to a prospective employer.

Deliver complete, runnable code, not snippets or pseudocode. Do not leave TODOs.

---

## 1. Tech stack (fixed, do not deviate)

- **React 18 + TypeScript (strict mode) + Vite**
- **Plain CSS with CSS custom properties** (CSS Modules or a single organized stylesheet). No Tailwind or component libraries (MUI, Chakra, etc.), because the design must be custom.
- **Native `fetch`** against the **GitHub REST API v3** (`https://api.github.com`). No Octokit, no API token, no backend. The app is fully client-side and deployable as static files.
- **Vitest + React Testing Library** for tests.
- **ESLint + Prettier** configured; code must pass lint with zero warnings.
- Fonts: load via Google Fonts with `display=swap` (one display or serif face for headings and one sans or mono face for body/metadata), with proper fallback stacks.

---

## 2. Functional requirements

### 2.1 Input and generation (core user stories)

- **FR-1** A text input labeled "GitHub username" with a placeholder (e.g. `torvalds`), `autocomplete="off"`, `autocapitalize="none"`, `spellcheck="false"`, and autofocus on load.
- **FR-2** A primary **Generate** button. Pressing **Enter** in the input also triggers generation (use a `<form>` with `onSubmit`).
- **FR-3** Trim whitespace from the input and strip a leading `@` if present.
- **FR-4** **Client-side validation before any network call.** A valid GitHub username is 1 to 39 characters, only alphanumerics or single hyphens, and cannot start or end with a hyphen or contain consecutive hyphens. Implement this as a pure function (not a lookbehind regex, for Safari compatibility).
  - Empty input: show "Please enter a GitHub username."
  - Malformed input: show "That doesn't look like a valid GitHub username."
- **FR-5** **Nonexistent user warning (required user story).** If the API returns **404** for `GET /users/{username}`, display a clearly visible warning: *"We couldn't find a GitHub user named '{username}'. Check the spelling and try again."* No timeline is rendered in this case.
- **FR-6** The button is disabled while a request is in flight, and the input is not cleared on error.

### 2.2 Data fetching

- **FR-7** First call `GET /users/{username}` to verify the user exists and to get profile data (name, login, avatar_url, bio, html_url, public_repos, created_at).
- **FR-8** Then fetch repos via `GET /users/{username}/repos?per_page=100&type=owner&sort=created&direction=desc&page=N`, **paginating until a page returns fewer than 100 items** (or until the `Link` header has no `rel="next"`). Users with more than 100 repos must be fully supported.
- **FR-9** Only **public** repos are shown (this endpoint returns public repos only, but also filter defensively with `!repo.private`).
- **FR-10** Fields used per repo: `name`, `html_url`, `description`, `created_at`, `language`, `stargazers_count`, `fork`, `archived`, `homepage` (optional).
- **FR-11** Use an `AbortController` so a new request cancels any in-flight one, and results from stale requests never overwrite newer ones (no race conditions).
- **FR-12** Cache results in an in-memory `Map` (and optionally `sessionStorage` with a 10-minute TTL) keyed by lowercase username, so re-generating the same user doesn't spend API quota.

### 2.3 Timeline rendering

- **FR-13** Render a **vertical timeline** with a central spine (alternating left and right cards on desktop, a single column with the spine on the left on mobile).
- **FR-14** Each entry shows:
  - **Repo name** (a link to the repo, opens in a new tab with `rel="noopener noreferrer"`)
  - **Creation date**, formatted human-readable (e.g. "March 14, 2023") using `Intl.DateTimeFormat`, plus a machine-readable `<time datetime="...">` element
  - **Description**, or a muted italic fallback "No description provided." when null
  - Primary **language** as a small colored chip (use a map of common GitHub language colors; fall back to a neutral color)
  - Star count if > 0, and a "Fork" badge if it is a fork
- **FR-15** **Year markers**: insert a visually distinct year label on the spine whenever the year changes between consecutive entries.
- **FR-16** **Controls** (above the timeline):
  - Sort toggle: **Newest first** (default) / **Oldest first**
  - Checkbox: **Include forks** (default: off)
  - Checkbox: **Include archived** (default: on)
  - Controls update the view instantly without refetching.
- **FR-17** A **profile header** above the timeline: avatar, display name, `@login` linking to the profile, bio, and "N public repos · joined YEAR".
- **FR-18** **Empty state**: if the user exists but has zero (visible) public repos, show a friendly message: "{username} has no public repositories to show yet."

### 2.4 Bonus feature

- **FR-19** **Repos per year summary**: a compact horizontal bar chart (pure SVG or CSS, no chart library) showing the count of repos created in each year, with the count labeled on each bar. It respects the current filters (forks and archived). Clicking a year bar smooth-scrolls to that year's marker in the timeline. Include a text-based accessible alternative (a visually hidden table or `aria-label` listing each year and count).

### 2.5 Sharing

- **FR-20** **Deep-linkable URL**: reflect the username in the query string (`?user=octocat`) using `history.replaceState`. If the page loads with `?user=...`, auto-generate that timeline.
- **FR-21** A "Copy link" button that copies the current URL to the clipboard and shows a brief "Copied!" confirmation (with a fallback if the Clipboard API is unavailable).
- **FR-22** `<title>` and meta description update to "{username}'s GitHub Timeline". Include Open Graph meta tags with static defaults.

### 2.6 Error handling (every case must have a distinct, human message)

| Case | Behavior |
|---|---|
| Empty or invalid input | Inline validation message, no request |
| 404 on user | Warning from FR-5 |
| 403 or 429 with `x-ratelimit-remaining: 0` | "GitHub's rate limit was reached. Try again at {local time from `x-ratelimit-reset`}." |
| Network failure or offline | "Couldn't reach GitHub. Check your connection and try again." with a **Retry** button |
| 5xx | "GitHub is having trouble right now. Please try again shortly." |
| Malformed or unexpected JSON | Generic error, with the details logged to the console |

Errors are shown in an element with `role="alert"` so screen readers announce them.

### 2.7 Loading state

- **FR-23** While loading, show **skeleton timeline cards** (shimmering placeholders), not a bare spinner. The button label changes to "Generating…".

---

## 3. Non-functional requirements

### 3.1 Design and visual quality

- **NFR-1** A deliberate, cohesive design system defined with CSS custom properties: color palette (background, surface, text, muted text, accent, border, success, warning, danger), type scale, spacing scale (4px base), radii, and shadows.
- **NFR-2** Color is used with purpose: one strong accent for the spine, dots, and links, with a secondary accent for year markers. Language chips use their GitHub colors, with text color chosen automatically for readable contrast.
- **NFR-3** Typography hierarchy: display or serif heading face for the title and year markers, a clean sans for body text, and a monospace face for repo names and dates. Comfortable line-height (1.5 to 1.7) and a max line length of about 65ch inside cards.
- **NFR-4** **Light and dark themes**: respect `prefers-color-scheme` by default, with a manual toggle that persists to `localStorage` (guarded with try/catch).
- **NFR-5** Subtle motion: cards fade and slide in as they enter the viewport (`IntersectionObserver`), hover lifts on cards, and a smooth spine "draw" animation. **All motion is disabled under `prefers-reduced-motion: reduce`.**
- **NFR-6** The landing state (before any search) is attractive: a hero with the title, a one-line tagline, the input form, and a few clickable example usernames.
- **NFR-7** Print-friendly: a `@media print` stylesheet that hides controls, uses a single-column layout, and avoids breaking cards across pages, so the timeline can be saved as a PDF.

### 3.2 Responsiveness

- **NFR-8** Mobile-first. Works from 320px to 2560px wide. Alternating layout at 768px and up, single column below. No horizontal scrolling at any width. Tap targets at least 44×44px.

### 3.3 Accessibility (target WCAG 2.1 AA)

- **NFR-9** Semantic HTML: `<header>`, `<main>`, `<form>`, `<label>` tied to the input, `<ol>` for the timeline with `<li>` per entry, `<article>` per card, and a sensible `<h1>`/`<h2>`/`<h3>` hierarchy.
- **NFR-10** Color contrast of at least 4.5:1 for text and 3:1 for UI components in **both** themes.
- **NFR-11** Full keyboard operability with visible `:focus-visible` outlines. Includes a "Skip to timeline" link.
- **NFR-12** Status updates ("Loaded 42 repositories for octocat") announced via a polite `aria-live` region. Errors use `role="alert"`.
- **NFR-13** Decorative elements (spine, dots) are `aria-hidden`. Avatar images have meaningful `alt` text.

### 3.4 Performance

- **NFR-14** Lighthouse scores on the production build: **Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90**.
- **NFR-15** Initial JS bundle under 150 KB gzipped. No heavy dependencies.
- **NFR-16** For users with more than 100 timeline entries, render efficiently (CSS `content-visibility: auto` on cards, or incremental rendering with a "Show more" button). No layout jank.
- **NFR-17** Memoize derived data (filtered and sorted lists, year counts) with `useMemo`.

### 3.5 Reliability and security

- **NFR-18** No secrets or tokens in the client code. Unauthenticated API use only (60 requests per hour limit), which is acknowledged in the UI footer.
- **NFR-19** **Never render API content as HTML.** Descriptions are rendered as text only (React escaping), with no `dangerouslySetInnerHTML`. All external links use `rel="noopener noreferrer"`.
- **NFR-20** Add a restrictive `<meta http-equiv="Content-Security-Policy">` allowing connections only to `api.github.com`, with images from `avatars.githubusercontent.com` and `data:`.
- **NFR-21** Graceful degradation: a `<noscript>` message explaining that JavaScript is required.

### 3.6 Code quality and architecture

- **NFR-22** Clean folder structure:

  ```
  src/
    api/          github.ts (fetch, pagination, error mapping)
    components/   SearchForm, ProfileHeader, Controls, YearSummary,
                  Timeline, TimelineItem, YearMarker, Skeleton,
                  ErrorMessage, ThemeToggle
    hooks/        useTimeline.ts, useTheme.ts, useInView.ts
    utils/        validateUsername.ts, groupByYear.ts, formatDate.ts,
                  languageColors.ts
    styles/       tokens.css, base.css, timeline.css, print.css
    types/        github.ts
    App.tsx, main.tsx
  ```

- **NFR-23** Strong typing: no `any`. Define interfaces for `GitHubUser` and `GitHubRepo`, and a discriminated union for request state (`idle | loading | success | error`) with typed error kinds (`not_found | rate_limited | network | server | unknown`).
- **NFR-24** Pure functions for logic (validation, sorting, grouping) so they can be unit-tested in isolation. The API layer is separate from the UI.
- **NFR-25** Small, single-purpose components with documented props. Comments explain *why*, not *what*.

### 3.7 Browser support

- **NFR-26** Latest two versions of Chrome, Firefox, Safari, and Edge, plus iOS Safari and Android Chrome.

---

## 4. Testing requirements

- **Unit tests (Vitest):** `validateUsername` (valid and invalid cases including lengths of 1, 39, and 40 characters, leading or trailing hyphens, double hyphens, and unicode), `groupByYear`, sorting, filtering, and `formatDate`.
- **API tests (mock `fetch`):** successful single page, multi-page pagination (more than 100 repos), 404, rate-limit 403 with headers, network rejection, and abort handling.
- **Component tests (React Testing Library):**
  - Submitting with empty input shows validation.
  - An invalid username shows a warning without any fetch call.
  - A 404 shows the not-found warning.
  - A success renders N timeline items with name, date, and description.
  - The "No description provided." fallback appears.
  - Filters and sort update the list.
  - The year summary counts match the timeline.
- Target at least 80% coverage on `utils/` and `api/`.

---

## 5. Deliverables

1. Complete source code, with every file shown in full, organized by the folder structure above.
2. `package.json` with scripts: `dev`, `build`, `preview`, `test`, `lint`.
3. A **README.md** containing: a project description, a screenshot placeholder, features, tech stack, setup and run instructions, a section on design decisions and trade-offs, a section on known limitations (e.g. the unauthenticated rate limit), and deployment steps for **GitHub Pages, Netlify, or Vercel**.
4. A short **requirements traceability table** mapping each FR/NFR ID to the file(s) that implement it.

---

## 6. Acceptance checklist (verify before finishing)

- [ ] Entering a valid username and clicking Generate (or pressing Enter) renders a timeline with repo name, creation date, and description for each public repo
- [ ] An invalid or nonexistent username shows a clear warning and no timeline
- [ ] Users with more than 100 repos are fully displayed
- [ ] Bonus: a repos-per-year summary is displayed and matches the timeline
- [ ] Works and looks polished at 320px, 768px, and 1440px, in light and dark mode
- [ ] Keyboard-only and screen-reader flows work end to end
- [ ] All error cases in section 2.6 are handled with the specified messages
- [ ] `npm run lint`, `npm run test`, and `npm run build` all pass with zero errors
- [ ] No `any` types, no `dangerouslySetInnerHTML`, no console errors

Before writing code, briefly state your plan and any assumptions. Then provide all the code, followed by the README and the traceability table.
