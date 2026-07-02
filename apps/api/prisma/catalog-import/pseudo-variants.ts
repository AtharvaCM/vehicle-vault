const CITY_VARIANT_NAMES = new Set([
  'ahmedabad',
  'bangalore',
  'chennai',
  'delhi',
  'hyderabad',
  'jaipur',
  'kolkata',
  'lucknow',
  'mumbai',
  'pune',
]);

export function isPseudoCatalogVariant(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();

  if (CITY_VARIANT_NAMES.has(lower)) return true;
  if (/^with\s+[\w.-]/i.test(normalized)) return true;
  if (/\bvideos?$/i.test(normalized)) return true;
  if (/\brange\s+details$/i.test(normalized)) return true;

  return false;
}
