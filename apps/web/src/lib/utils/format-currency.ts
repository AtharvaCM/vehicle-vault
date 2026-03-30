export function formatCurrency(value: number, currencyCode = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: currencyCode === 'INR' ? 0 : 2,
  }).format(value);
}
