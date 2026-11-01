import type { TimelineEntry } from '../utils/groupByYear';
import { pluralize } from '../utils/pluralize';
import { TimelineItem } from './TimelineItem';
import { YearMarker } from './YearMarker';

/** Above this many rendered cards, opt into `content-visibility` to skip off-screen work. */
const LARGE_LIST_THRESHOLD = 100;

export interface TimelineProps {
  /** Year markers and repo cards, already filtered, sorted and sliced. */
  entries: readonly TimelineEntry[];
  /** Number of matching repos not yet rendered (incremental rendering). */
  remaining: number;
  onShowMore: () => void;
}

export function Timeline({ entries, remaining, onShowMore }: TimelineProps) {
  const cardCount = entries.filter((entry) => entry.kind === 'repo').length;
  const isLarge = cardCount > LARGE_LIST_THRESHOLD;

  return (
    <div className="timeline-wrapper">
      <h2 className="visually-hidden">Timeline</h2>
      <div className={`timeline${isLarge ? ' timeline--large' : ''}`}>
        <div className="timeline__spine" aria-hidden="true" />
        <ol className="timeline__list" aria-label="Repository timeline">
          {entries.map((entry) =>
            entry.kind === 'year' ? (
              <YearMarker key={entry.key} year={entry.year} />
            ) : (
              <TimelineItem key={entry.key} repo={entry.repo} side={entry.side} />
            ),
          )}
        </ol>
      </div>
      {remaining > 0 && (
        <div className="timeline__more no-print">
          <button type="button" className="button button--secondary" onClick={onShowMore}>
            Show more ({pluralize(remaining, 'repository', 'repositories')} left)
          </button>
        </div>
      )}
    </div>
  );
}

