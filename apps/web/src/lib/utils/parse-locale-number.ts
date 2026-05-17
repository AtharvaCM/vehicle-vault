/**
 * Parse numeric values from spreadsheet/CSV cells, including common Indian formats
 * (₹, Rs., INR) and grouped thousands (e.g. 1,23,456.78).
 */
export function parseLocaleNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }

  if (typeof value === 'number') {
    return value;
  }

  let str = String(value).trim();
  if (!str) {
    return NaN;
  }

  str = str.replace(/^(?:₹|rs\.?|inr)\s*/i, '');
  str = str.replace(/\s*(?:₹|rs\.?|inr)$/i, '');
  str = str.trim();

  str = str.replace(/,/g, '');

  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return NaN;
  }

  return Number.parseFloat(match[0]);
}
