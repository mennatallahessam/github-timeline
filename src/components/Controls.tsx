import type { ReactNode } from 'react';
import type { RepoFilters, SortOrder } from '../utils/repoFilters';

export interface ControlsProps {
  filters: RepoFilters;
  onChange: (filters: RepoFilters) => void;
  /** Number of repos left after filtering. */
  shownCount: number;
  /** Number of public repos before filtering. */
  totalCount: number;
  /** Extra actions rendered at the end of the toolbar (e.g. "Copy link"). */
  actions?: ReactNode;
}

const SORT_OPTIONS: readonly { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
];

export function Controls({ filters, onChange, shownCount, totalCount, actions }: ControlsProps) {
  const update = (patch: Partial<RepoFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="controls no-print">
      <div className="controls__group">
        <fieldset className="segmented">
          <legend className="visually-hidden">Sort order</legend>
          {SORT_OPTIONS.map((option) => (
            <span key={option.value} className="segmented__option">
              <input
                className="segmented__input"
                type="radio"
                id={`sort-${option.value}`}
                name="sort-order"
                value={option.value}
                checked={filters.sort === option.value}
                onChange={() => update({ sort: option.value })}
              />
              <label className="segmented__label" htmlFor={`sort-${option.value}`}>
                {option.label}
              </label>
            </span>
          ))}
        </fieldset>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.includeForks}
            onChange={(event) => update({ includeForks: event.target.checked })}
          />
          <span>Include forks</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={filters.includeArchived}
            onChange={(event) => update({ includeArchived: event.target.checked })}
          />
          <span>Include archived</span>
        </label>
      </div>

      <div className="controls__group controls__group--end">
        <p className="controls__count">
          Showing <strong>{shownCount}</strong> of {totalCount}
        </p>
        {actions}
      </div>
    </div>
  );
}
