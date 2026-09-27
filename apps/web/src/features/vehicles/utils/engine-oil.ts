import { format } from '@/lib/format';

/**
 * "5W-30 · 3.8 L": the engine oil the owner recorded on the vehicle (#332),
 * either half alone, or null when neither is on file. The catalog has no oil data.
 */
export function engineOilLine(vehicle: {
  engineOilGrade?: string | null;
  engineOilLitres?: number | null;
}): string | null {
  const parts = [
    vehicle.engineOilGrade?.trim() || null,
    vehicle.engineOilLitres != null ? `${format.number(vehicle.engineOilLitres)} L` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
