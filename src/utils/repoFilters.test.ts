import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixtures';
import { DEFAULT_FILTERS, applyFilters, filterRepos, sortRepos } from './repoFilters';

const source = makeRepo({ id: 1, name: 'source', created_at: '2022-01-01T00:00:00Z' });
const fork = makeRepo({ id: 2, name: 'fork', fork: true, created_at: '2023-01-01T00:00:00Z' });
const archived = makeRepo({
  id: 3,
  name: 'archived',
  archived: true,
  created_at: '2021-01-01T00:00:00Z',
});
const secret = makeRepo({
  id: 4,
  name: 'secret',
  private: true,
  created_at: '2024-01-01T00:00:00Z',
});
const all = [source, fork, archived, secret];

describe('filterRepos', () => {
  it('excludes forks and keeps archived repos by default', () => {
    expect(filterRepos(all, DEFAULT_FILTERS).map((r) => r.name)).toEqual(['source', 'archived']);
  });

  it('can include forks and exclude archived', () => {
    expect(
      filterRepos(all, { includeForks: true, includeArchived: false }).map((r) => r.name),
    ).toEqual(['source', 'fork']);
  });

  it('never includes private repos', () => {
    expect(filterRepos(all, { includeForks: true, includeArchived: true })).not.toContain(secret);
  });
});

describe('sortRepos', () => {
  it('sorts newest first', () => {
    expect(sortRepos(all, 'newest').map((r) => r.id)).toEqual([4, 2, 1, 3]);
  });

  it('sorts oldest first', () => {
    expect(sortRepos(all, 'oldest').map((r) => r.id)).toEqual([3, 1, 2, 4]);
  });

  it('breaks ties by name and does not mutate the input', () => {
    const a = makeRepo({ name: 'alpha', created_at: '2020-01-01T00:00:00Z' });
    const b = makeRepo({ name: 'beta', created_at: '2020-01-01T00:00:00Z' });
    const input = [b, a];
    expect(sortRepos(input, 'newest').map((r) => r.name)).toEqual(['alpha', 'beta']);
    expect(input).toEqual([b, a]);
  });
});

describe('applyFilters', () => {
  it('filters then sorts', () => {
    expect(
      applyFilters(all, { sort: 'oldest', includeForks: true, includeArchived: true }).map(
        (r) => r.name,
      ),
    ).toEqual(['archived', 'source', 'fork']);
  });
});
