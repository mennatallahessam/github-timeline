export interface ErrorMessageProps {
  /** Human-readable message (never raw API output). */
  message: string;
  /** `warning` for user mistakes (e.g. unknown user), `danger` for failures. */
  variant?: 'warning' | 'danger';
  /** When provided, a Retry button is shown. */
  onRetry?: () => void;
}

export function ErrorMessage({ message, variant = 'danger', onRetry }: ErrorMessageProps) {
  return (
    <div className={`alert alert--${variant}`} role="alert">
      <svg className="alert__icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2 1 21h22L12 2Zm0 4.5L19.5 19h-15L12 6.5ZM11 10v4h2v-4h-2Zm0 6v2h2v-2h-2Z"
        />
      </svg>
      <div className="alert__body">
        <p className="alert__message">{message}</p>
        {onRetry && (
          <button type="button" className="button button--secondary alert__retry" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
