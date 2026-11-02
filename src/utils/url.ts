/**
 * Returns the URL only if it is an absolute http(s) URL. API data is untrusted,
 * so this prevents `javascript:` (or other scheme) links from ever reaching an href.
 * Bare domains like "example.com" (common in repo homepages) are upgraded to https.
 */
export function toSafeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Builds a shareable URL for a username, preserving the current path. */
export function buildShareUrl(username: string, current: string): string {
  const url = new URL(current);
  url.search = '';
  url.hash = '';
  url.searchParams.set('user', username);
  return url.href;
}
