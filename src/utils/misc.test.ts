import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';
import { describeError, errorVariant, isRetryable } from './errorMessages';
import {
  FALLBACK_LANGUAGE_COLOR,
  contrastRatio,
  getLanguageColor,
  getReadableTextColor,
  relativeLuminance,
} from './languageColors';
import { pluralize } from './pluralize';
import { buildShareUrl, toSafeHttpUrl } from './url';

describe('languageColors', () => {
  it('returns known colours and falls back for unknown or missing languages', () => {
    expect(getLanguageColor('TypeScript')).toBe('#3178c6');
    expect(getLanguageColor('Brainfuck-ish')).toBe(FALLBACK_LANGUAGE_COLOR);
    expect(getLanguageColor(null)).toBe(FALLBACK_LANGUAGE_COLOR);
  });

  it('computes luminance and contrast', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
    expect(relativeLuminance('#000')).toBeCloseTo(0);
    expect(relativeLuminance('nope')).toBe(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
  });

  it('picks readable text colours', () => {
    expect(getReadableTextColor('#f1e05a')).toBe('#111111'); // JavaScript yellow
    expect(getReadableTextColor('#000080')).toBe('#ffffff'); // Lua navy
  });
});

describe('errorMessages', () => {
  it('describes every error kind distinctly', () => {
    const messages = (['not_found', 'rate_limited', 'network', 'server', 'unknown'] as const).map(
      (kind) => describeError({ kind, username: 'ghost' }),
    );
    expect(new Set(messages).size).toBe(5);
    expect(messages[0]).toBe(
      "We couldn't find a GitHub user named 'ghost'. Check the spelling and try again.",
    );
    expect(messages[2]).toBe("Couldn't reach GitHub. Check your connection and try again.");
    expect(messages[3]).toBe('GitHub is having trouble right now. Please try again shortly.');
  });

  it('includes the reset time for rate limits', () => {
    const resetAt = new Date(2024, 0, 1, 15, 42);
    expect(describeError({ kind: 'rate_limited', username: 'x', resetAt }, 'en-US')).toMatch(
      /^GitHub's rate limit was reached\. Try again at 3:42\sPM\.$/,
    );
  });

  it('classifies variants and retryability', () => {
    expect(errorVariant({ kind: 'not_found', username: 'x' })).toBe('warning');
    expect(errorVariant({ kind: 'server', username: 'x' })).toBe('danger');
    expect(isRetryable({ kind: 'network', username: 'x' })).toBe(true);
    expect(isRetryable({ kind: 'server', username: 'x' })).toBe(true);
    expect(isRetryable({ kind: 'not_found', username: 'x' })).toBe(false);
  });
});

describe('url helpers', () => {
  it('accepts only http(s) URLs', () => {
    expect(toSafeHttpUrl('https://github.com/a')).toBe('https://github.com/a');
    expect(toSafeHttpUrl('example.com')).toBe('https://example.com/');
    expect(toSafeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(toSafeHttpUrl('ftp://example.com')).toBeNull();
    expect(toSafeHttpUrl('   ')).toBeNull();
    expect(toSafeHttpUrl(null)).toBeNull();
    expect(toSafeHttpUrl('http://exa mple.com')).toBeNull();
  });

  it('builds a share URL with only the user param', () => {
    expect(buildShareUrl('octocat', 'https://example.com/app/?user=old&x=1#top')).toBe(
      'https://example.com/app/?user=octocat',
    );
  });
});

describe('pluralize', () => {
  it('chooses singular or plural', () => {
    expect(pluralize(1, 'repo')).toBe('1 repo');
    expect(pluralize(2, 'repo')).toBe('2 repos');
    expect(pluralize(0, 'repository', 'repositories')).toBe('0 repositories');
  });
});

describe('copyText', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the Clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    await expect(copyText('hello')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('reports failure when every strategy fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn(() => {
      throw new Error('unsupported');
    });
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    await expect(copyText('hello')).resolves.toBe(false);
  });
});
