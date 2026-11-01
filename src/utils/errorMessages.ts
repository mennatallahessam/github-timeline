import type { TimelineError } from '../types/github';
import { formatTime } from './formatDate';

/** Maps a typed error to the human message shown to the user (section 2.6). */
export function describeError(error: TimelineError, locale?: string): string {
  switch (error.kind) {
    case 'not_found':
      return `We couldn't find a GitHub user named '${error.username}'. Check the spelling and try again.`;
    case 'rate_limited':
      return error.resetAt
        ? `GitHub's rate limit was reached. Try again at ${formatTime(error.resetAt, locale)}.`
        : "GitHub's rate limit was reached. Try again in a few minutes.";
    case 'network':
      return "Couldn't reach GitHub. Check your connection and try again.";
    case 'server':
      return 'GitHub is having trouble right now. Please try again shortly.';
    case 'unknown':
      return 'Something went wrong while loading this timeline. Please try again.';
  }
}

/** Not-found is a user mistake (warning); everything else is a failure (danger). */
export function errorVariant(error: TimelineError): 'warning' | 'danger' {
  return error.kind === 'not_found' ? 'warning' : 'danger';
}

/** Only transient failures are worth a one-click retry. */
export function isRetryable(error: TimelineError): boolean {
  return error.kind === 'network' || error.kind === 'server';
}

