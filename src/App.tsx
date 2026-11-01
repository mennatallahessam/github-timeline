import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { CopyLinkButton } from './components/CopyLinkButton';
import { ErrorMessage } from './components/ErrorMessage';
import { ProfileHeader } from './components/ProfileHeader';
import { SearchForm } from './components/SearchForm';
import { Skeleton } from './components/Skeleton';
import { ThemeToggle } from './components/ThemeToggle';
import { Timeline } from './components/Timeline';
import { YearSummary } from './components/YearSummary';
import { useTheme } from './hooks/useTheme';
import { useTimeline } from './hooks/useTimeline';
import type { GitHubRepo, RequestState } from './types/github';
import { describeError, errorVariant, isRetryable } from './utils/errorMessages';
import { getYear } from './utils/formatDate';
import { buildTimelineEntries, countByYear, yearAnchorId } from './utils/groupByYear';
import { pluralize } from './utils/pluralize';
import { DEFAULT_FILTERS, applyFilters, type RepoFilters } from './utils/repoFilters';
import { buildShareUrl } from './utils/url';
import { validateUsername } from './utils/validateUsername';

/** Cards rendered per batch; keeps the first paint fast for users with huge histories. */
const PAGE_SIZE = 60;
const EXAMPLE_USERS = ['torvalds', 'gaearon', 'sindresorhus', 'octocat'] as const;
const DEFAULT_TITLE = 'GitHub Timeline';
const DEFAULT_DESCRIPTION =
  "Turn any GitHub user's public repositories into a beautiful, shareable timeline.";
const EMPTY_REPOS: GitHubRepo[] = [];

function setMetaDescription(content: string): void {
  document.querySelector('meta[name="description"]')?.setAttribute('content', content);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function statusMessageFor(state: RequestState): string {
  switch (state.status) {
    case 'loading':
      return `Loading repositories for ${state.username}…`;
    case 'success':
      return `Loaded ${pluralize(state.data.repos.length, 'repository', 'repositories')} for ${state.data.user.login}`;
    case 'error':
    case 'idle':
      return '';
  }
}

export function App() {
  const { theme, toggleTheme } = useTheme();
  const { state, generate, retry } = useTimeline();
  const [input, setInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RepoFilters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingYear, setPendingYear] = useState<number | null>(null);

  const submit = useCallback(
    (raw: string) => {
      const result = validateUsername(raw);
      if (!result.ok) {
        setValidationError(result.message);
        return;
      }
      setValidationError(null);
      window.history.replaceState(null, '', buildShareUrl(result.username, window.location.href));
      void generate(result.username);
    },
    [generate],
  );

  // Deep link: `?user=octocat` generates on load (FR-20).
  useEffect(() => {
    const user = new URLSearchParams(window.location.search).get('user');
    if (user) {
      setInput(user);
      submit(user);
    }
  }, [submit]);

  const handleExample = useCallback(
    (username: string) => {
      setInput(username);
      submit(username);
    },
    [submit],
  );

  const repos = state.status === 'success' ? state.data.repos : EMPTY_REPOS;
  const filteredRepos = useMemo(() => applyFilters(repos, filters), [repos, filters]);
  const yearCounts = useMemo(() => countByYear(filteredRepos), [filteredRepos]);
  const visibleRepos = useMemo(
    () => filteredRepos.slice(0, visibleCount),
    [filteredRepos, visibleCount],
  );
  const entries = useMemo(() => buildTimelineEntries(visibleRepos), [visibleRepos]);

  // A new dataset or filter starts again from the first batch.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [repos, filters]);

  const handleSelectYear = useCallback(
    (year: number) => {
      const index = filteredRepos.findIndex((repo) => getYear(repo.created_at) === year);
      if (index === -1) return;
      // Make sure the target year is rendered before scrolling to it.
      setVisibleCount((count) => Math.max(count, index + PAGE_SIZE));
      setPendingYear(year);
    },
    [filteredRepos],
  );

  // Scroll after the render that guarantees the marker exists in the DOM.
  useEffect(() => {
    if (pendingYear === null) return;
    const marker = document.getElementById(yearAnchorId(pendingYear));
    if (marker) {
      if (typeof marker.scrollIntoView === 'function') {
        marker.scrollIntoView({
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          block: 'start',
        });
      }
      marker.focus({ preventScroll: true });
    }
    setPendingYear(null);
  }, [pendingYear]);

  // Document title + meta description (FR-22).
  useEffect(() => {
    if (state.status === 'success') {
      const label = `${state.data.user.login}'s GitHub Timeline`;
      document.title = label;
      setMetaDescription(label);
    } else if (state.status === 'idle') {
      document.title = DEFAULT_TITLE;
      setMetaDescription(DEFAULT_DESCRIPTION);
    }
  }, [state]);

  const getShareUrl = useCallback(() => window.location.href, []);
  const isLoading = state.status === 'loading';

  return (
    <div className="app">
      <a className="skip-link" href="#timeline">
        Skip to timeline
      </a>

      <header className="site-header">
        <a className="brand" href="./" aria-label="GitHub Timeline home">
          <svg
            className="brand__mark"
            viewBox="0 0 32 32"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <rect width="32" height="32" rx="8" fill="currentColor" />
            <path d="M16 5v22" stroke="var(--color-bg)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="16" cy="11" r="3.2" fill="var(--color-bg)" />
            <circle cx="16" cy="21" r="3.2" fill="var(--color-secondary)" />
          </svg>
          <span className="brand__name">GitHub Timeline</span>
        </a>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main id="main" className="main">
        <section
          className={`hero${state.status === 'idle' ? '' : ' hero--compact'}`}
          aria-labelledby="app-title"
        >
          <h1 id="app-title" className="hero__title">
            GitHub <em>Timeline</em>
          </h1>
          <p className="hero__tagline">
            Every public repository a developer has created, laid out in the order it was born.
          </p>
          <SearchForm
            value={input}
            onChange={setInput}
            onSubmit={submit}
            isLoading={isLoading}
            validationError={validationError}
            examples={state.status === 'idle' ? EXAMPLE_USERS : []}
            onExample={handleExample}
          />
        </section>

        <p className="visually-hidden" role="status" aria-live="polite">
          {statusMessageFor(state)}
        </p>

        <section id="timeline" className="results" tabIndex={-1} aria-label="Results">
          {state.status === 'loading' && <Skeleton count={4} />}

          {state.status === 'error' && (
            <ErrorMessage
              message={describeError(state.error)}
              variant={errorVariant(state.error)}
              onRetry={isRetryable(state.error) ? retry : undefined}
            />
          )}

          {state.status === 'success' && (
            <>
              <ProfileHeader user={state.data.user} />
              {repos.length === 0 ? (
                <p className="empty-state">
                  {state.data.user.login} has no public repositories to show yet.
                </p>
              ) : (
                <>
                  <Controls
                    filters={filters}
                    onChange={setFilters}
                    shownCount={filteredRepos.length}
                    totalCount={repos.length}
                    actions={<CopyLinkButton getUrl={getShareUrl} />}
                  />
                  <YearSummary counts={yearCounts} onSelectYear={handleSelectYear} />
                  {filteredRepos.length === 0 ? (
                    <p className="empty-state">
                      {state.data.user.login} has no public repositories to show yet with these
                      filters. Try including forks or archived repositories.
                    </p>
                  ) : (
                    <Timeline
                      entries={entries}
                      remaining={filteredRepos.length - visibleRepos.length}
                      onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
                    />
                  )}
                </>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Data from the public{' '}
          <a href="https://docs.github.com/en/rest" target="_blank" rel="noopener noreferrer">
            GitHub REST API
          </a>
          , requested without authentication, so GitHub allows about 60 requests per hour per IP
          address. Results are cached in your browser for 10 minutes.
        </p>
      </footer>
    </div>
  );
}
