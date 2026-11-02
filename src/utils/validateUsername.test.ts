import { describe, expect, it } from 'vitest';
import {
  VALIDATION_MESSAGES,
  isValidUsername,
  normalizeUsername,
  validateUsername,
} from './validateUsername';

describe('isValidUsername', () => {
  it.each(['a', 'A', '7', 'octocat', 'Octo-Cat', 'a-b-c', 'user123', 'a'.repeat(39)])(
    'accepts %s',
    (name) => {
      expect(isValidUsername(name)).toBe(true);
    },
  );

  it.each([
    ['empty string', ''],
    ['40 characters', 'a'.repeat(40)],
    ['leading hyphen', '-octocat'],
    ['trailing hyphen', 'octocat-'],
    ['only a hyphen', '-'],
    ['double hyphen', 'octo--cat'],
    ['underscore', 'octo_cat'],
    ['dot', 'octo.cat'],
    ['space', 'octo cat'],
    ['at sign', '@octocat'],
    ['unicode letter', 'ócto'],
    ['emoji', 'cat😺'],
    ['cyrillic', 'кот'],
  ])('rejects %s', (_label, name) => {
    expect(isValidUsername(name)).toBe(false);
  });

  it('accepts exactly 1 and 39 characters but not 40', () => {
    expect(isValidUsername('x')).toBe(true);
    expect(isValidUsername('x'.repeat(39))).toBe(true);
    expect(isValidUsername('x'.repeat(40))).toBe(false);
  });
});

describe('normalizeUsername', () => {
  it('trims whitespace and strips a leading @', () => {
    expect(normalizeUsername('  octocat  ')).toBe('octocat');
    expect(normalizeUsername('@octocat')).toBe('octocat');
    expect(normalizeUsername('  @octocat ')).toBe('octocat');
  });

  it('only strips one leading @', () => {
    expect(normalizeUsername('@@octocat')).toBe('@octocat');
  });
});

describe('validateUsername', () => {
  it('returns the normalised username when valid', () => {
    expect(validateUsername(' @torvalds ')).toEqual({ ok: true, username: 'torvalds' });
  });

  it('reports empty input', () => {
    expect(validateUsername('   ')).toEqual({
      ok: false,
      reason: 'empty',
      message: VALIDATION_MESSAGES.empty,
    });
    expect(validateUsername('@')).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('reports malformed input', () => {
    expect(validateUsername('bad--name')).toEqual({
      ok: false,
      reason: 'invalid',
      message: VALIDATION_MESSAGES.invalid,
    });
  });
});
