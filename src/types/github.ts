/** Subset of `GET /users/{username}` that the app relies on. */
export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  html_url: string;
  public_repos: number;
  created_at: string;
}

/** Subset of a repository object from `GET /users/{username}/repos`. */
export interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  archived: boolean;
  homepage: string | null;
  private: boolean;
}

/** Everything needed to draw one user's timeline. */
export interface TimelineData {
  user: GitHubUser;
  repos: GitHubRepo[];
}

export type FetchErrorKind = 'not_found' | 'rate_limited' | 'network' | 'server' | 'unknown';

export interface TimelineError {
  kind: FetchErrorKind;
  /** The username that was requested (as typed, after normalisation). */
  username: string;
  /** When the rate limit resets; only present for `rate_limited`. */
  resetAt?: Date;
}

export type RequestState =
  | { status: 'idle' }
  | { status: 'loading'; username: string }
  | { status: 'success'; username: string; data: TimelineData }
  | { status: 'error'; username: string; error: TimelineError };

