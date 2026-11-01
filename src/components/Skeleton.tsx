export interface SkeletonProps {
  /** Number of placeholder cards to show. */
  count?: number;
}

/** Shimmering stand-in for the profile and timeline while data loads. */
export function Skeleton({ count = 4 }: SkeletonProps) {
  return (
    <div className="skeleton-view" aria-hidden="true" data-testid="skeleton">
      <div className="profile profile--skeleton">
        <div className="skeleton skeleton--avatar" />
        <div className="profile__body">
          <div className="skeleton skeleton--heading" />
          <div className="skeleton skeleton--line skeleton--short" />
          <div className="skeleton skeleton--line" />
        </div>
      </div>
      <div className="timeline">
        <div className="timeline__spine timeline__spine--static" />
        <ol className="timeline__list">
          {Array.from({ length: count }, (_, index) => (
            <li
              key={index}
              className={`timeline__item timeline__item--${index % 2 === 0 ? 'left' : 'right'}`}
            >
              <span className="timeline__dot" />
              <div className="card card--skeleton">
                <div className="skeleton skeleton--title" />
                <div className="skeleton skeleton--line skeleton--short" />
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--line skeleton--medium" />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

