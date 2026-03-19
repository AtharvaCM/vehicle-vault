export function formatMaintenanceCategory(category: string) {
  return category
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
