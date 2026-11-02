import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRepo, makeUser } from '../test/fixtures';
import type { TimelineData } from '../types/github';
import { CACHE_TTL_MS, clearTimelineCache, getCachedTimeline, setCachedTimeline } from './cache';

const data: TimelineData = { user: makeUser(), repos: [makeRepo(), makeRepo()] };

beforeEach(() => {
  clearTimelineCache();
  sessionStorage.clear();
});

describe('timeline cache', () => {
  it('stores and returns data keyed case-insensitively', () => {
    setCachedTimeline('OctoCat', data, 1000);
    expect(getCachedTimeline('octocat', 2000)).toEqual(data);
  });

  it('expires entries after the TTL', () => {
    setCachedTimeline('octocat', data, 0);
    expect(getCachedTimeline('octocat', CACHE_TTL_MS + 1)).toBeNull();
  });

  it('survives a cleared memory cache via sessionStorage', () => {
    const now = Date.now();
    setCachedTimeline('octocat', data, now);
    const raw = sessionStorage.getItem('gh-timeline:v1:octocat');
    clearTimelineCache();
    expect(getCachedTimeline('octocat', now)).toBeNull();

    // Simulate a reload: memory is empty but sessionStorage still has the entry.
    sessionStorage.setItem('gh-timeline:v1:octocat', raw ?? '');
    expect(getCachedTimeline('octocat', now)).toEqual(data);
  });

  it('ignores and removes corrupt or expired persisted entries', () => {
    sessionStorage.setItem('gh-timeline:v1:bad', '{not json');
    expect(getCachedTimeline('bad')).toBeNull();

    sessionStorage.setItem(
      'gh-timeline:v1:shape',
      JSON.stringify({ expiresAt: Date.now() + 1000, data: { user: {}, repos: [] } }),
    );
    expect(getCachedTimeline('shape')).toBeNull();

    sessionStorage.setItem(
      'gh-timeline:v1:old',
      JSON.stringify({ expiresAt: 1, data: { user: makeUser(), repos: [] } }),
    );
    expect(getCachedTimeline('old')).toBeNull();
    expect(sessionStorage.getItem('gh-timeline:v1:old')).toBeNull();

    sessionStorage.setItem(
      'gh-timeline:v1:repos',
      JSON.stringify({ expiresAt: Date.now() + 1000, data: { user: makeUser(), repos: [{}] } }),
    );
    expect(getCachedTimeline('repos')).toBeNull();
  });

  it('keeps working when sessionStorage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    setCachedTimeline('octocat', data);
    expect(getCachedTimeline('octocat')).toEqual(data);
    setItem.mockRestore();
  });
});
