/** Minimal English pluraliser for UI copy ("1 repository", "2 repositories"). */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
