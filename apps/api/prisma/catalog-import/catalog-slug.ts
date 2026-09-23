/** The slug every catalog row is keyed by: lower case, `&` spelled out, runs of anything else as one hyphen. */
export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
