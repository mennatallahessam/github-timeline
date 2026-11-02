import { getLanguageColor, getReadableTextColor } from '../utils/languageColors';
import { pluralize } from '../utils/pluralize';
import type { LanguageStat } from '../utils/repoFilters';

export interface LanguageBreakdownProps {
  /** Language counts and percentages across the currently visible (fork/archive-filtered) repos. */
  stats: readonly LanguageStat[];
  /** Currently active language filter, or null when showing all languages. */
  selectedLanguage: string | null;
  /** Toggles a language filter (passing null clears the filter). */
  onSelectLanguage: (language: string | null) => void;
}

export function LanguageBreakdown({
  stats,
  selectedLanguage,
  onSelectLanguage,
}: LanguageBreakdownProps) {
  if (stats.length === 0) return null;

  const handleToggle = (language: string) => {
    onSelectLanguage(selectedLanguage === language ? null : language);
  };

  return (
    <section className="language-breakdown" aria-labelledby="language-breakdown-title">
      <div className="language-breakdown__header">
        <h2 id="language-breakdown-title" className="section-title">
          Languages
        </h2>
        {selectedLanguage && (
          <button
            type="button"
            className="language-breakdown__clear no-print"
            onClick={() => onSelectLanguage(null)}
          >
            Clear filter ({selectedLanguage}) ×
          </button>
        )}
      </div>

      <div className="language-breakdown__bar" aria-hidden="true">
        {stats.map(({ language, percentage }) => {
          const isDimmed = selectedLanguage !== null && selectedLanguage !== language;
          return (
            <span
              key={language}
              className={`language-breakdown__segment${isDimmed ? ' language-breakdown__segment--dimmed' : ''}`}
              style={{
                width: `${percentage}%`,
                backgroundColor: getLanguageColor(language),
              }}
              title={`${language}: ${percentage}%`}
            />
          );
        })}
      </div>

      <ul className="language-breakdown__chips" aria-label="Filter repositories by language">
        {stats.map(({ language, count, percentage }) => {
          const isSelected = selectedLanguage === language;
          const color = getLanguageColor(language);
          return (
            <li key={language}>
              <button
                type="button"
                className={`language-filter-chip${isSelected ? ' language-filter-chip--active' : ''}`}
                aria-pressed={isSelected}
                aria-label={`${language}: ${pluralize(count, 'repository', 'repositories')} (${percentage}%). ${
                  isSelected ? 'Remove language filter.' : `Filter by ${language}.`
                }`}
                onClick={() => handleToggle(language)}
                style={
                  isSelected
                    ? {
                        backgroundColor: color,
                        color: getReadableTextColor(color),
                        borderColor: color,
                      }
                    : undefined
                }
              >
                <span
                  className="language-filter-chip__dot"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="language-filter-chip__name">{language}</span>
                <span className="language-filter-chip__meta" aria-hidden="true">
                  {count} · {percentage}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
