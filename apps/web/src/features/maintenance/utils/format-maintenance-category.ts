/** Words written as an acronym rather than capitalised. */
const ACRONYMS: Record<string, string> = { cvt: 'CVT', puc: 'PUC' };

export function formatMaintenanceCategory(category: string) {
  return category
    .split('_')
    .map((segment) => ACRONYMS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
