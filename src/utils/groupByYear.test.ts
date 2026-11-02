import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixtures';
import { buildTimelineEntries, countByYear, groupByYear, yearAnchorId } from './groupByYear';

const repos = [
  makeRepo({ id: 1, created_at: '2023-05-01T00:00:00Z' }),
  makeRepo({ id: 2, created_at: '2023-01-01T00:00:00Z' }),
  makeRepo({ id: 3, created_at: '2021-07-04T00:00:00Z' }),
  makeRepo({ id: 4, created_at: '2019-02-02T00:00:00Z' }),
  makeRepo({ id: 5, created_at: '2019-01-01T00:00:00Z' }),
];

describe('groupByYear', () => {
  it('groups consecutive repos by year, preserving order', () => {
    const groups = groupByYear(repos);
    expect(groups.map((g) => g.year)).toEqual([2023, 2021, 2019]);
    expect(groups.map((g) => g.repos.map((r) => r.id))).toEqual([[1, 2], [3], [4, 5]]);
  });

  it('returns an empty array for no repos', () => {
    expect(groupByYear([])).toEqual([]);
  });
});

describe('countByYear', () => {
  it('counts repos per year in ascending year order', () => {
    expect(countByYear(repos)).toEqual([
      { year: 2019, count: 2 },
      { year: 2021, count: 1 },
      { year: 2023, count: 2 },
    ]);
  });

  it('is independent of input order', () => {
    expect(countByYear([...repos].reverse())).toEqual(countByYear(repos));
  });
});

describe('buildTimelineEntries', () => {
  it('inserts a year marker whenever the year changes', () => {
    const entries = buildTimelineEntries(repos);
    expect(entries.map((e) => (e.kind === 'year' ? `Y${e.year}` : e.repo.id))).toEqual([
      'Y2023',
      1,
      2,
      'Y2021',
      3,
      'Y2019',
      4,
      5,
    ]);
  });

  it('alternates card sides, ignoring year markers', () => {
    const sides = buildTimelineEntries(repos).flatMap((e) => (e.kind === 'repo' ? [e.side] : []));
    expect(sides).toEqual(['left', 'right', 'left', 'right', 'left']);
  });

  it('produces unique keys', () => {
    const keys = buildTimelineEntries(repos).map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('yearAnchorId', () => {
  it('builds a stable DOM id', () => {
    expect(yearAnchorId(2020)).toBe('year-2020');
  });
});
