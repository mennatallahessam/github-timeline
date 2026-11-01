import { describe, expect, it } from 'vitest';
import { formatDate, formatTime, getYear } from './formatDate';

describe('formatDate', () => {
  it('formats ISO timestamps as long US dates', () => {
    expect(formatDate('2023-03-14T09:26:53Z')).toBe('March 14, 2023');
  });

  it('uses UTC so the date matches the year marker near midnight', () => {
    expect(formatDate('2022-12-31T23:59:59Z')).toBe('December 31, 2022');
    expect(formatDate('2023-01-01T00:00:01Z')).toBe('January 1, 2023');
  });

  it('supports other locales', () => {
    expect(formatDate('2023-03-14T09:26:53Z', 'de-DE')).toBe('14. März 2023');
  });

  it('handles invalid input gracefully', () => {
    expect(formatDate('not a date')).toBe('Unknown date');
  });
});

describe('getYear', () => {
  it('returns the UTC year', () => {
    expect(getYear('2019-12-31T23:30:00Z')).toBe(2019);
    expect(getYear('2020-01-01T00:30:00Z')).toBe(2020);
  });
});

describe('formatTime', () => {
  it('formats a time of day', () => {
    const date = new Date(2024, 0, 1, 15, 42);
    expect(formatTime(date, 'en-US')).toMatch(/3:42\sPM/);
  });
});

