import type { PublicCatalogSpec } from '@vehicle-vault/shared';

import { formatSpecNumber } from '../utils/format-public-catalog';

type SpecValue = number | string | boolean | null;
type SpecRow = [label: string, value: SpecValue, unit?: string];

type SpecSection = {
  title: string;
  rows: SpecRow[];
};

/**
 * The spec groups a public page shows, in reading order. A row with no value is
 * dropped, and a section with no rows left is dropped with it, so a thin record
 * reads as a short page rather than a wall of dashes.
 */
export function buildSpecSections(specs: PublicCatalogSpec): SpecSection[] {
  const sections: SpecSection[] = [
    {
      title: 'Engine and drivetrain',
      rows: [
        ['Displacement', specs.engineCc, 'cc'],
        ['Cylinders', specs.engineCyl],
        ['Engine type', specs.engineType],
        ['Fuel', specs.engineFuel],
        [
          'Max power',
          specs.powerPs,
          specs.powerRpm ? `PS @ ${formatSpecNumber(specs.powerRpm)} rpm` : 'PS',
        ],
        [
          'Max torque',
          specs.torqueNm,
          specs.torqueRpm ? `Nm @ ${formatSpecNumber(specs.torqueRpm)} rpm` : 'Nm',
        ],
        ['Transmission', specs.transmission],
        ['Gears', specs.gearCount],
        ['Drivetrain', specs.driveType],
        ['Cooling', specs.coolingType],
      ],
    },
    {
      title: 'Battery and charging',
      rows: [
        ['Battery', specs.batteryKwh, 'kWh'],
        ['Claimed range', specs.rangeKm, 'km'],
        ['Motor', specs.motorKw, 'kW'],
        ['AC charging', specs.acChargeKw, 'kW'],
        ['DC fast charging', specs.dcFastChargeKw, 'kW'],
        ['DC charge, 0–80%', specs.chargeTime0To80Min, 'min'],
      ],
    },
    {
      title: 'Economy and performance',
      rows: [
        ['Claimed mileage (combined)', specs.mileageCombined, 'km/l'],
        ['Claimed mileage (city)', specs.mileageCity, 'km/l'],
        ['Claimed mileage (highway)', specs.mileageHighway, 'km/l'],
        ['Fuel tank', specs.fuelCapLitres, 'L'],
        ['Top speed', specs.topSpeedKph, 'km/h'],
      ],
    },
    {
      title: 'Dimensions',
      rows: [
        ['Length', specs.lengthMm, 'mm'],
        ['Width', specs.widthMm, 'mm'],
        ['Height', specs.heightMm, 'mm'],
        ['Wheelbase', specs.wheelbaseMm, 'mm'],
        ['Ground clearance', specs.groundClearanceMm, 'mm'],
        ['Seat height', specs.seatHeightMm, 'mm'],
        ['Kerb weight', specs.kerbWeightKg, 'kg'],
        ['Boot space', specs.bootSpaceLitres, 'L'],
      ],
    },
    {
      title: 'Body, wheels and brakes',
      rows: [
        ['Body type', specs.bodyType],
        ['Seats', specs.seatingCapacity],
        ['Doors', specs.doors],
        ['Tyre size', specs.tyreSize],
        ['Wheel size', specs.wheelSizeInch, 'inch'],
        ['Front brake', specs.brakeFrontType],
        ['Rear brake', specs.brakeRearType],
      ],
    },
    {
      title: 'Safety',
      rows: [
        ['Airbags', specs.airbagCount],
        [
          'Crash test (adult)',
          specs.ncapStarsAdult,
          specs.ncapRegion ? `stars, ${specs.ncapRegion}` : 'stars',
        ],
        [
          'Crash test (child)',
          specs.ncapStarsChild,
          specs.ncapRegion ? `stars, ${specs.ncapRegion}` : 'stars',
        ],
        ['ABS', specs.hasAbs],
        ['ABS channels', specs.absChannels],
        ['Electronic stability control', specs.hasEsc],
      ],
    },
  ];

  return sections
    .map((section) => ({ ...section, rows: section.rows.filter(([, value]) => hasValue(value)) }))
    .filter((section) => section.rows.length > 0);
}

function hasValue(value: SpecValue) {
  if (value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function formatValue(value: SpecValue, unit?: string) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const text = typeof value === 'number' ? formatSpecNumber(value) : String(value);
  return unit ? `${text} ${unit}` : text;
}

type PublicSpecSectionsProps = {
  specs: PublicCatalogSpec;
};

export function PublicSpecSections({ specs }: PublicSpecSectionsProps) {
  const sections = buildSpecSections(specs);
  if (sections.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map((section) => (
        <section
          aria-label={section.title}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          key={section.title}
        >
          <h3 className="text-sm font-semibold text-slate-950">{section.title}</h3>
          <dl className="mt-3 divide-y divide-slate-100 text-sm">
            {section.rows.map(([label, value, unit]) => (
              <div className="flex justify-between gap-4 py-2" key={label}>
                <dt className="text-slate-600">{label}</dt>
                <dd className="min-w-0 text-right font-medium text-slate-900 [overflow-wrap:anywhere]">
                  {formatValue(value, unit)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
