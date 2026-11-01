import { useEffect, useRef, useState } from 'react';
import { copyText } from '../utils/clipboard';

export interface CopyLinkButtonProps {
  /** Returns the URL to copy at click time (so it always reflects the latest state). */
  getUrl: () => string;
}

const CONFIRMATION_MS = 2000;

export function CopyLinkButton({ getUrl }: CopyLinkButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleClick = async () => {
    const url = getUrl();
    const ok = await copyText(url);
    if (!ok) {
      // Last resort: let the user copy it manually from a native dialog.
      window.prompt('Copy this link:', url);
    }
    setStatus(ok ? 'copied' : 'failed');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus('idle'), CONFIRMATION_MS);
  };

  return (
    <button
      type="button"
      className="button button--ghost copy-link"
      onClick={() => void handleClick()}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
        />
      </svg>
      <span aria-live="polite">{status === 'copied' ? 'Copied!' : 'Copy link'}</span>
    </button>
  );
}
