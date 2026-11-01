import { useInView } from '../hooks/useInView';
import type { GitHubRepo } from '../types/github';
import { formatDate } from '../utils/formatDate';
import type { TimelineSide } from '../utils/groupByYear';
import { getLanguageColor, getReadableTextColor } from '../utils/languageColors';
import { pluralize } from '../utils/pluralize';
import { toSafeHttpUrl } from '../utils/url';

export interface TimelineItemProps {
  /** Repository rendered in this card. */
  repo: GitHubRepo;
  /** Side of the spine the card sits on in the two-column (≥768px) layout. */
  side: TimelineSide;
}

export function TimelineItem({ repo, side }: TimelineItemProps) {
  const { ref, inView } = useInView<HTMLElement>();
  const repoUrl = toSafeHttpUrl(repo.html_url);
  const homepage = toSafeHttpUrl(repo.homepage);
  const languageColor = getLanguageColor(repo.language);

  return (
    <li className={`timeline__item timeline__item--${side}`}>
      <span className="timeline__dot" aria-hidden="true" />
      <article ref={ref} className={`card ${inView ? 'card--visible' : 'card--hidden'}`}>
        <div className="card__header">
          <h4 className="card__title">
            {repoUrl ? (
              <a href={repoUrl} target="_blank" rel="noopener noreferrer">
                {repo.name}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ) : (
              repo.name
            )}
          </h4>
          <time className="card__date" dateTime={repo.created_at}>
            {formatDate(repo.created_at)}
          </time>
        </div>

        {repo.description ? (
          <p className="card__description">{repo.description}</p>
        ) : (
          <p className="card__description card__description--empty">No description provided.</p>
        )}

        <div className="card__meta">
          {repo.language && (
            <span
              className="chip chip--language"
              style={{ backgroundColor: languageColor, color: getReadableTextColor(languageColor) }}
            >
              {repo.language}
            </span>
          )}
          {repo.stargazers_count > 0 && (
            <span className="card__stars">
              <span aria-hidden="true">★ {repo.stargazers_count.toLocaleString('en-US')}</span>
              <span className="visually-hidden">{pluralize(repo.stargazers_count, 'star')}</span>
            </span>
          )}
          {repo.fork && <span className="badge badge--fork">Fork</span>}
          {repo.archived && <span className="badge badge--archived">Archived</span>}
          {homepage && (
            <a className="card__homepage" href={homepage} target="_blank" rel="noopener noreferrer">
              Website<span className="visually-hidden"> for {repo.name} (opens in a new tab)</span>
            </a>
          )}
        </div>
      </article>
    </li>
  );
}

