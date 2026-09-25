import { format } from '@/lib/format';

import type { VehicleVariantSpec } from '../hooks/use-variant-specs';

/**
 * The few catalogue figures an owner reaches for (buying tyres, filling up,
 * telling a mechanic what the engine is), as one line. The rest of the sheet is
 * one tap further. Null when the catalogue carries none of them.
 */
export function keySpecsLine(specs: VehicleVariantSpec): string | null {
  const engine = [
    specs.engineCc ? `${format.number(specs.engineCc, { decimals: 0 })} cc` : null,
    specs.engineFuel?.trim().toLowerCase() || null,
  ]
    .filter(Boolean)
    .join(' ');

  const parts = [
    specs.tyreSize?.trim() ? `Tyres ${specs.tyreSize.trim()}` : null,
    specs.fuelCapLitres ? `Tank ${format.number(specs.fuelCapLitres, { decimals: 1 })} L` : null,
    engine || null,
    specs.transmission?.trim() || null,
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(' · ') : null;
}
