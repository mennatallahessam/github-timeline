export const MAX_USERNAME_LENGTH = 39;

export const VALIDATION_MESSAGES = {
  empty: 'Please enter a GitHub username.',
  invalid: "That doesn't look like a valid GitHub username.",
} as const;

export type UsernameValidation =
  | { ok: true; username: string }
  | { ok: false; reason: keyof typeof VALIDATION_MESSAGES; message: string };

/** Trims whitespace and a single leading `@` (people often paste "@octocat"). */
export function normalizeUsername(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

function isAsciiAlphanumeric(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) // a-z
  );
}

/**
 * GitHub's username rules: 1–39 chars, ASCII alphanumerics or single hyphens,
 * no leading/trailing hyphen. Written as a loop rather than a regex with
 * lookbehind because older Safari versions throw on lookbehind syntax.
 */
export function isValidUsername(name: string): boolean {
  if (name.length < 1 || name.length > MAX_USERNAME_LENGTH) return false;
  if (name.startsWith('-') || name.endsWith('-')) return false;

  for (let i = 0; i < name.length; i++) {
    const char = name.charAt(i);
    if (char === '-') {
      if (name.charAt(i - 1) === '-') return false;
    } else if (!isAsciiAlphanumeric(char)) {
      return false;
    }
  }
  return true;
}

/** Normalises raw input and reports a user-facing message when it is unusable. */
export function validateUsername(raw: string): UsernameValidation {
  const username = normalizeUsername(raw);
  if (username === '') {
    return { ok: false, reason: 'empty', message: VALIDATION_MESSAGES.empty };
  }
  if (!isValidUsername(username)) {
    return { ok: false, reason: 'invalid', message: VALIDATION_MESSAGES.invalid };
  }
  return { ok: true, username };
}
