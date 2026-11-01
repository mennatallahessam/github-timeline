import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { jsonResponse, makeRepo, makeRepos, makeUser } from '../test/fixtures';
import {
  GitHubApiError,
  fetchAllRepos,
  fetchTimeline,
  fetchUser,
  hasNextPage,
  isAbortError,
  parseRepo,
  parseUser,
  reposPageUrl,
  toApiError,
} from './github';

type FetchMock = Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const urlOf = (call: Parameters<FetchMock>): string => String(call[0]);

async function expectApiError(promise: Promise<unknown>): Promise<GitHubApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GitHubApiError);
    return error as GitHubApiError;
  }
  throw new Error('Expected promise to reject');
}

describe('fetchTimeline', () => {
  it('loads a user and a single page of repos', async () => {
    const user = makeUser();
    const repos = [makeRepo(), makeRepo()];
    fetchMock.mockResolvedValueOnce(jsonResponse(user)).mockResolvedValueOnce(jsonResponse(repos));

    const data = await fetchTimeline('octocat');

    expect(data.user).toEqual(user);
    expect(data.repos).toEqual(repos);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock.mock.calls[0])).toBe('https://api.github.com/users/octocat');
    expect(urlOf(fetchMock.mock.calls[1])).toBe(reposPageUrl('octocat', 1));
    expect(urlOf(fetchMock.mock.calls[1])).toContain(
      'per_page=100&type=owner&sort=created&direction=desc&page=1',
    );
  });

  it('paginates through more than 100 repos', async () => {
    const all = makeRepos(250);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeUser({ public_repos: 250 })))
      .mockResolvedValueOnce(jsonResponse(all.slice(0, 100)))
      .mockResolvedValueOnce(jsonResponse(all.slice(100, 200)))
      .mockResolvedValueOnce(jsonResponse(all.slice(200)));

    const data = await fetchTimeline('octocat');

    expect(data.repos).toHaveLength(250);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(urlOf(fetchMock.mock.calls[3])).toContain('page=3');
  });

  it('stops when the Link header has no rel="next"', async () => {
    const page = makeRepos(100);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(page, {
        headers: { link: '<https://api.github.com/x?page=1>; rel="prev"' },
      }),
    );
    const repos = await fetchAllRepos('octocat');
    expect(repos).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('continues when the Link header has rel="next"', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(makeRepos(100), {
          headers: { link: '<https://api.github.com/x?page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse([]));
    expect(await fetchAllRepos('octocat')).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('filters out private repos defensively', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeUser()))
      .mockResolvedValueOnce(jsonResponse([makeRepo({ private: true }), makeRepo()]));
    const data = await fetchTimeline('octocat');
    expect(data.repos).toHaveLength(1);
  });

  it('maps 404 to not_found', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not Found' }, { status: 404 }));
    const error = await expectApiError(fetchTimeline('ghost'));
    expect(error.kind).toBe('not_found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps a 403 with exhausted quota to rate_limited with the reset time', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { message: 'API rate limit exceeded' },
        {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
        },
      ),
    );
    const error = await expectApiError(fetchUser('octocat'));
    expect(error.kind).toBe('rate_limited');
    expect(error.resetAt?.getTime()).toBe(1_700_000_000_000);
  });

  it('maps network failures to network errors', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await expectApiError(fetchTimeline('octocat'));
    expect(error.kind).toBe('network');
  });

  it('maps 5xx to server errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, { status: 502 }));
    expect((await expectApiError(fetchUser('octocat'))).kind).toBe('server');
  });

  it('maps malformed JSON to unknown and logs details', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }));
    expect((await expectApiError(fetchUser('octocat'))).kind).toBe('unknown');
    expect(console.error).toHaveBeenCalled();
  });

  it('maps unexpected shapes to unknown', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }));
    expect((await expectApiError(fetchUser('octocat'))).kind).toBe('unknown');

    fetchMock.mockResolvedValueOnce(jsonResponse({ not: 'an array' }));
    expect((await expectApiError(fetchAllRepos('octocat'))).kind).toBe('unknown');

    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 'nope' }]));
    expect((await expectApiError(fetchAllRepos('octocat'))).kind).toBe('unknown');
  });

  it('propagates aborts without wrapping them', async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    const controller = new AbortController();
    const promise = fetchTimeline('octocat', controller.signal);
    controller.abort();

    await expect(promise).rejects.toSatisfy(isAbortError);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});

describe('toApiError', () => {
  it('treats 429 as rate limited even without quota headers', () => {
    const error = toApiError(new Response(null, { status: 429, headers: { 'retry-after': '30' } }));
    expect(error.kind).toBe('rate_limited');
    expect(error.resetAt).toBeInstanceOf(Date);
  });

  it('treats a 403 with remaining quota as unknown', () => {
    const error = toApiError(
      new Response(null, { status: 403, headers: { 'x-ratelimit-remaining': '10' } }),
    );
    expect(error.kind).toBe('unknown');
  });

  it('leaves resetAt undefined when no reset headers are present', () => {
    const error = toApiError(
      new Response(null, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    );
    expect(error.kind).toBe('rate_limited');
    expect(error.resetAt).toBeUndefined();
  });
});

describe('helpers', () => {
  it('detects rel="next" in Link headers', () => {
    expect(hasNextPage('<a>; rel="next", <b>; rel="last"')).toBe(true);
    expect(hasNextPage('<a>; rel="prev"')).toBe(false);
    expect(hasNextPage(null)).toBe(false);
  });

  it('identifies abort errors', () => {
    expect(isAbortError(new DOMException('x', 'AbortError'))).toBe(true);
    expect(isAbortError(new Error('x'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });

  it('parses users and repos, normalising optional fields', () => {
    expect(parseUser(null)).toBeNull();
    expect(parseUser({ ...makeUser(), name: undefined, bio: 42 })).toMatchObject({
      name: null,
      bio: null,
    });
    expect(parseRepo('nope')).toBeNull();
    expect(parseRepo({ ...makeRepo(), created_at: 'garbage' })).toBeNull();
    const parsed = parseRepo({
      ...makeRepo(),
      description: undefined,
      stargazers_count: undefined,
      archived: undefined,
      private: undefined,
      extra: 'ignored',
    });
    expect(parsed).toMatchObject({
      description: null,
      stargazers_count: 0,
      archived: false,
      private: true,
    });
    expect(parsed).not.toHaveProperty('extra');
  });
});
