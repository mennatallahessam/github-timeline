import { useCallback, useEffect, useRef, useState } from 'react';
import { getCachedTimeline, setCachedTimeline } from '../api/cache';
import { GitHubApiError, fetchTimeline, isAbortError } from '../api/github';
import type { RequestState, TimelineError } from '../types/github';

function toTimelineError(error: unknown, username: string): TimelineError {
  if (error instanceof GitHubApiError) {
    return { kind: error.kind, username, resetAt: error.resetAt };
  }
  console.error('[GitHub Timeline] Unexpected error', error);
  return { kind: 'unknown', username };
}

export interface UseTimelineResult {
  state: RequestState;
  /** Loads (or serves from cache) the timeline for an already-validated username. */
  generate: (username: string) => Promise<void>;
  /** Re-runs the most recent request, bypassing nothing (failed requests are never cached). */
  retry: () => void;
}

/**
 * Owns the request lifecycle. Every call aborts the previous request and is
 * tagged with an incrementing id, so a slow, stale response can never
 * overwrite the result of a newer one, even if the abort arrives too late.
 */
export function useTimeline(): UseTimelineResult {
  const [state, setState] = useState<RequestState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const lastUsernameRef = useRef<string | null>(null);

  const generate = useCallback(async (username: string) => {
    controllerRef.current?.abort();
    const requestId = ++requestIdRef.current;
    lastUsernameRef.current = username;

    const cached = getCachedTimeline(username);
    if (cached) {
      controllerRef.current = null;
      setState({ status: 'success', username, data: cached });
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading', username });

    try {
      const data = await fetchTimeline(username, controller.signal);
      if (requestId !== requestIdRef.current) return;
      setCachedTimeline(username, data);
      setState({ status: 'success', username, data });
    } catch (error) {
      if (requestId !== requestIdRef.current || isAbortError(error)) return;
      setState({ status: 'error', username, error: toTimelineError(error, username) });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  const retry = useCallback(() => {
    if (lastUsernameRef.current) void generate(lastUsernameRef.current);
  }, [generate]);

  // Abort in-flight work on unmount so no state update targets an unmounted tree.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { state, generate, retry };
}
