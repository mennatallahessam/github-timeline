import type { ChangeEvent, FormEvent } from 'react';

export interface SearchFormProps {
  /** Current (raw, un-normalised) input value. */
  value: string;
  onChange: (value: string) => void;
  /** Called with the raw value; validation happens in the parent so deep links share it. */
  onSubmit: (value: string) => void;
  /** Disables the button and swaps its label while a request is in flight. */
  isLoading: boolean;
  /** Inline validation message, or null when the input is acceptable. */
  validationError: string | null;
  /** Usernames offered as one-click examples on the landing screen. */
  examples?: readonly string[];
  onExample?: (username: string) => void;
}

const INPUT_ID = 'username-input';
const ERROR_ID = 'username-error';
const HINT_ID = 'username-hint';

export function SearchForm({
  value,
  onChange,
  onSubmit,
  isLoading,
  validationError,
  examples = [],
  onExample,
}: SearchFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value);
  };

  const describedBy = validationError ? `${HINT_ID} ${ERROR_ID}` : HINT_ID;

  return (
    <form className="search-form" onSubmit={handleSubmit} noValidate role="search">
      <label className="search-form__label" htmlFor={INPUT_ID}>
        GitHub username
      </label>
      <div className="search-form__row">
        <div className="search-form__field">
          <span className="search-form__prefix" aria-hidden="true">
            @
          </span>
          <input
            id={INPUT_ID}
            className="search-form__input"
            type="text"
            name="username"
            placeholder="torvalds"
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            // Autofocus is acceptable here: entering a username is the page's single purpose.
            autoFocus
            maxLength={60}
            aria-invalid={validationError ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
        <button
          className="button button--primary search-form__submit"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Generating…' : 'Generate'}
        </button>
      </div>
      <p id={HINT_ID} className="visually-hidden">
        Press Enter or the Generate button to build the timeline.
      </p>
      {validationError && (
        <p id={ERROR_ID} className="search-form__error" role="alert">
          {validationError}
        </p>
      )}
      {examples.length > 0 && onExample && (
        <p className="search-form__examples">
          <span className="search-form__examples-label">Try:</span>
          {examples.map((name) => (
            <button
              key={name}
              type="button"
              className="example-chip"
              onClick={() => onExample(name)}
              disabled={isLoading}
            >
              {name}
            </button>
          ))}
        </p>
      )}
    </form>
  );
}
