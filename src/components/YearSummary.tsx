import type { YearCount } from '../utils/groupByYear';
import { pluralize } from '../utils/pluralize';

export interface YearSummaryProps {
  /** Repo counts per year (already filtered), ascending by year. */
  counts: readonly YearCount[];
  /** Called when a bar is activated; the parent scrolls the timeline to that year. */
  onSelectYear: (year: number) => void;
}

export function YearSummary({ counts, onSelectYear }: YearSummaryProps) {
  if (counts.length === 0) return null;
  const max = Math.max(...counts.map((c) => c.count));

  return (
    <section className="year-summary" aria-labelledby="year-summary-title">
      <h2 id="year-summary-title" className="section-title">
        Repositories per year
      </h2>
      <ul className="year-summary__chart">
        {counts.map(({ year, count }) => (
          <li key={year}>
            <button
              type="button"
              className="year-bar"
              onClick={() => onSelectYear(year)}
              aria-label={`${year}: ${pluralize(count, 'repository', 'repositories')}. Jump to ${year} in the timeline.`}
            >
              <span className="year-bar__year">{year}</span>
              <span className="year-bar__track" aria-hidden="true">
                <span className="year-bar__fill" style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="year-bar__count" aria-hidden="true">
                {count}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <table className="visually-hidden" data-testid="year-summary-table">
        <caption>Number of repositories created each year</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Repositories</th>
          </tr>
        </thead>
        <tbody>
          {counts.map(({ year, count }) => (
            <tr key={year}>
              <th scope="row">{year}</th>
              <td>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
