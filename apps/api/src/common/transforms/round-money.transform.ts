export function roundMoney(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return value;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
}
