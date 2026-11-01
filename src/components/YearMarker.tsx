import { yearAnchorId } from '../utils/groupByYear';

export interface YearMarkerProps {
  /** Calendar year shown on the spine. */
  year: number;
}

export function YearMarker({ year }: YearMarkerProps) {
  return (
    <li className="timeline__year">
      <span className="timeline__year-dot" aria-hidden="true" />
      {/* tabIndex -1 lets the year summary move keyboard focus here after scrolling. */}
      <h3 id={yearAnchorId(year)} className="year-marker" tabIndex={-1}>
        {year}
      </h3>
    </li>
  );
}

