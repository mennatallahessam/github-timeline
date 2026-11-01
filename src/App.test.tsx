import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { clearTimelineCache } from './api/cache';
import { jsonResponse, makeRepo, makeUser } from './test/fixtures';
import type { GitHubRepo } from './types/github';
import { VALIDATION_MESSAGES } from './utils/validateUsername';

const repos: GitHubRepo[] = [
  makeRepo({
    id: 1,
    name: 'newest-app',
    description: 'A shiny new app',
    created_at: '2024-03-14T10:00:00Z',
    stargazers_count: 42,
  }),
  makeRepo({
    id: 2,
    name: 'forked-lib',
    description: 'Someone else’s library',
    created_at: '2023-08-01T10:00:00Z',
    fork: true,
  }),
  makeRepo({
    id: 3,
    name: 'quiet-project',
    description: null,
    created_at: '2023-02-10T10:00:00Z',
    language: null,
  }),
  makeRepo({
    id: 4,
    name: 'old-archive',
    description: 'From the early days',
    created_at: '2019-05-20T10:00:00Z',
    archived: true,
  }),
];

function mockGitHub(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockSuccess(repoList: GitHubRepo[] = repos) {
  return mockGitHub((url) =>
    url.includes('/repos?')
      ? jsonResponse(repoList)
      : jsonResponse(makeUser({ public_repos: repoList.length })),
  );
}

async function generateFor(username: string) {
  const user = userEvent.setup();
  const input = screen.getByLabelText('GitHub username');
  await user.clear(input);
  if (username) await user.type(input, username);
  await user.click(screen.getByRole('button', { name: 'Generate' }));
  return user;
}

function timelineCards(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Repository timeline' })).getAllByRole('article');
}

beforeEach(() => {
  clearTimelineCache();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows a validation message for empty input without fetching', async () => {
    const fetchMock = mockSuccess();
    render(<App />);
    await generateFor('');
    expect(screen.getByRole('alert')).toHaveTextContent(VALIDATION_MESSAGES.empty);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('warns about an invalid username without any fetch call', async () => {
    const fetchMock = mockSuccess();
    render(<App />);
    await generateFor('bad--name');
    expect(screen.getByRole('alert')).toHaveTextContent(VALIDATION_MESSAGES.invalid);
    expect(screen.getByLabelText('GitHub username')).toHaveValue('bad--name');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the not-found warning for a 404 and renders no timeline', async () => {
    mockGitHub(() => jsonResponse({ message: 'Not Found' }, { status: 404 }));
    render(<App />);
    await generateFor('ghost-user');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't find a GitHub user named 'ghost-user'. Check the spelling and try again.",
    );
    expect(screen.queryByRole('list', { name: 'Repository timeline' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('GitHub username')).toHaveValue('ghost-user');
  });

  it('shows the rate-limit message', async () => {
    mockGitHub(() =>
      jsonResponse(
        {},
        {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
        },
      ),
    );
    render(<App />);
    await generateFor('octocat');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /GitHub's rate limit was reached\. Try again at .+\./,
    );
  });

  it('offers a retry after a network failure', async () => {
    let attempts = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      attempts++;
      if (attempts === 1) return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(
        String(input).includes('/repos?') ? jsonResponse(repos) : jsonResponse(makeUser()),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    const user = await generateFor('octocat');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't reach GitHub. Check your connection and try again.",
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('list', { name: 'Repository timeline' })).toBeInTheDocument();
  });

  it('shows the server error message for 5xx responses', async () => {
    mockGitHub(() => jsonResponse({}, { status: 503 }));
    render(<App />);
    await generateFor('octocat');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'GitHub is having trouble right now. Please try again shortly.',
    );
  });

  it('renders a timeline item per visible repo with name, date and description', async () => {
    mockSuccess();
    render(<App />);
    await generateFor('@octocat ');

    const cards = await waitFor(timelineCards);
    // Forks are hidden by default.
    expect(cards).toHaveLength(3);

    const first = within(cards[0]);
    expect(first.getByRole('link', { name: /newest-app/ })).toHaveAttribute(
      'href',
      'https://github.com/octocat/repo-1',
    );
    expect(first.getByRole('link', { name: /newest-app/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(first.getByText('March 14, 2024')).toHaveAttribute('datetime', '2024-03-14T10:00:00Z');
    expect(first.getByText('A shiny new app')).toBeInTheDocument();
    expect(first.getByText('42 stars')).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'The Octocat' })).toBeInTheDocument();
    expect(window.location.search).toBe('?user=octocat');
    expect(document.title).toBe("octocat's GitHub Timeline");
    expect(screen.getByRole('status')).toHaveTextContent('Loaded 4 repositories for octocat');
  });

  it('shows the fallback for repos without a description', async () => {
    mockSuccess();
    render(<App />);
    await generateFor('octocat');
    await waitFor(timelineCards);
    const quiet = timelineCards().find((card) => within(card).queryByText('quiet-project'));
    expect(quiet).toBeDefined();
    expect(within(quiet as HTMLElement).getByText('No description provided.')).toBeInTheDocument();
  });

  it('updates the list when filters and sort change', async () => {
    mockSuccess();
    render(<App />);
    const user = await generateFor('octocat');
    await waitFor(timelineCards);

    const names = () =>
      timelineCards().map((card) => within(card).getByRole('heading', { level: 4 }).textContent);

    expect(names()[0]).toMatch(/newest-app/);

    await user.click(screen.getByLabelText('Include forks'));
    expect(timelineCards()).toHaveLength(4);
    expect(screen.getByText('Fork')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Include archived'));
    expect(timelineCards()).toHaveLength(3);

    await user.click(screen.getByLabelText('Oldest first'));
    expect(names()[0]).toMatch(/quiet-project/);
    expect(names()[2]).toMatch(/newest-app/);
  });

  it('renders year markers and a year summary that matches the timeline', async () => {
    mockSuccess();
    render(<App />);
    const user = await generateFor('octocat');
    await waitFor(timelineCards);

    const markers = within(screen.getByRole('list', { name: 'Repository timeline' }))
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(markers).toEqual(['2024', '2023', '2019']);

    const summaryCounts = () => {
      const table = screen.getByTestId('year-summary-table');
      return Object.fromEntries(
        within(table)
          .getAllByRole('row')
          .slice(1)
          .map((row) => {
            const year = within(row).getByRole('rowheader').textContent ?? '';
            const count = within(row).getByRole('cell').textContent ?? '0';
            return [year, Number(count)] as const;
          }),
      );
    };

    const timelineCounts = () => {
      const counts: Record<string, number> = {};
      for (const card of timelineCards()) {
        const year = (card.querySelector('time')?.getAttribute('datetime') ?? '').slice(0, 4);
        counts[year] = (counts[year] ?? 0) + 1;
      }
      return counts;
    };

    expect(summaryCounts()).toEqual({ '2019': 1, '2023': 1, '2024': 1 });
    expect(summaryCounts()).toEqual(timelineCounts());

    await user.click(screen.getByLabelText('Include forks'));
    expect(summaryCounts()).toEqual({ '2019': 1, '2023': 2, '2024': 1 });
    expect(summaryCounts()).toEqual(timelineCounts());

    // Clicking a bar moves focus to that year's marker.
    await user.click(screen.getByRole('button', { name: /^2019: 1 repository/ }));
    await waitFor(() => expect(document.getElementById('year-2019')).toHaveFocus());
  });

  it('shows the empty state for users with no public repos', async () => {
    mockSuccess([]);
    render(<App />);
    await generateFor('octocat');
    expect(
      await screen.findByText('octocat has no public repositories to show yet.'),
    ).toBeInTheDocument();
  });

  it('auto-generates from a ?user= deep link', async () => {
    const fetchMock = mockSuccess();
    window.history.replaceState(null, '', '/?user=octocat');
    render(<App />);
    expect(screen.getByLabelText('GitHub username')).toHaveValue('octocat');
    await waitFor(timelineCards);
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.github.com/users/octocat');
  });

  it('renders skeletons and disables the button while loading', async () => {
    mockGitHub(() => new Promise<Response>(() => undefined));
    render(<App />);
    await generateFor('octocat');
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
