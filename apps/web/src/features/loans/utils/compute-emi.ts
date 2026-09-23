/**
 * Client-side EMI preview. Matches the server's amortization math
 * (apps/api/src/modules/vehicle-loans/amortization.ts).
 */
export function computeEmiPreview(
  principal: number,
  annualRatePercent: number,
  tenureMonths: number,
): number {
  // An empty field arrives as undefined or NaN; the preview reads 0 until it is filled.
  if (!(tenureMonths > 0) || !(principal > 0)) return 0;
  const r = (Number.isFinite(annualRatePercent) ? annualRatePercent : 0) / 100 / 12;
  if (r === 0) return principal / tenureMonths;
  const pow = Math.pow(1 + r, tenureMonths);
  return (principal * r * pow) / (pow - 1);
}
