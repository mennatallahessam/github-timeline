import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTimelineCache } from '../api/cache';
import { jsonResponse, makeRepo, makeUser } from '../test/fixtures';
import { useTimeline } from './useTimeline';

beforeEach(() => {
  clearTimelineCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useTimeline', () => {
  it('ignores a stale response that resolves after a newer request', async () => {
    let releaseSlow: (() => void) | undefined;

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/users/slow')) {
        // Resolve late and ignore the abort signal to simulate a racing response.
        return new Promise<Response>((resolve) => {
          releaseSlow = () => resolve(jsonResponse(makeUser({ login: 'slow' })));
        });
      }
      if (url.includes('/users/slow/repos')) return Promise.resolve(jsonResponse([makeRepo()]));
      if (url.endsWith('/users/fast')) {
        return Promise.resolve(jsonResponse(makeUser({ login: 'fast' })));
      }
      return Promise.resolve(jsonResponse([makeRepo(), makeRepo()]));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTimeline());

    act(() => {
      void result.current.generate('slow');
    });
    await act(async () => {
      await result.current.generate('fast');
    });
    expect(result.current.state).toMatchObject({ status: 'success', username: 'fast' });

    await act(async () => {
      releaseSlow?.();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({ status: 'success', username: 'fast' }),
    );
  });

  it('serves repeated requests from the cache', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) =>
      Promise.resolve(
        String(input).includes('/repos') ? jsonResponse([makeRepo()]) : jsonResponse(makeUser()),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTimeline());
    await act(async () => {
      await result.current.generate('octocat');
    });
    await act(async () => {
      await result.current.generate('OctoCat');
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.state.status).toBe('success');
  });

  it('exposes typed errors and retries the last username', async () => {
    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(jsonResponse(makeUser()))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useTimeline());
    await act(async () => {
      await result.current.generate('octocat');
    });
    expect(result.current.state).toMatchObject({
      status: 'error',
      error: { kind: 'network', username: 'octocat' },
    });

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('success'));
  });
});
