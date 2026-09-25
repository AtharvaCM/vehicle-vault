import { Car, Fuel, Gauge, Ruler, ShieldCheck, CircleDot } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Figure } from '@/components/shared/figure';

import type { VehicleVariantSpec } from '../hooks/use-variant-specs';

/**
 * Every figure the catalogue has for a variant, grouped as a spec sheet. Only
 * the groups with something in them show. About this vehicle opens it under
 * the one-line summary, and it owns the lookup and its empty states.
 */
export function VehicleSpecSheet({ specs }: { specs: VehicleVariantSpec }) {
  return (
    <div className="space-y-6" data-testid="spec-sheet">
      <EngineSection specs={specs} />
      <DimensionsSection specs={specs} />
      <PerformanceSection specs={specs} />
      <BodySection specs={specs} />
      <TyresSection specs={specs} />
      <SafetySection specs={specs} />
    </div>
  );
}

type SpecSectionProps = {
  specs: VehicleVariantSpec;
};

function EngineSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Displacement', specs.engineCc, 'cc'],
    ['Cylinders', specs.engineCyl],
    ['Engine type', specs.engineType],
    ['Fuel', specs.engineFuel],
    ['Max power', specs.powerPs, specs.powerRpm ? `PS @ ${specs.powerRpm} rpm` : 'PS'],
    ['Max torque', specs.torqueNm, specs.torqueRpm ? `Nm @ ${specs.torqueRpm} rpm` : 'Nm'],
    ['Transmission', specs.transmission],
    ['Drivetrain', specs.driveType],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Gauge className="h-5 w-5" />} items={items} title="Engine & drivetrain" />
  );
}

function DimensionsSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Length', specs.lengthMm, 'mm'],
    ['Width', specs.widthMm, 'mm'],
    ['Height', specs.heightMm, 'mm'],
    ['Wheelbase', specs.wheelbaseMm, 'mm'],
    ['Kerb weight', specs.kerbWeightKg, 'kg'],
    ['Gross weight', specs.grossWeightKg, 'kg'],
    ['Boot space', specs.bootSpaceLitres, 'L'],
    ['Ground clearance', specs.groundClearanceMm, 'mm'],
    ['Turning radius', specs.turningRadiusM, 'm'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Ruler className="h-5 w-5" />} items={items} title="Dimensions & weight" />
  );
}

function PerformanceSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Top speed', specs.topSpeedKph, 'km/h'],
    ['Mileage (city)', specs.mileageCity, 'km/l'],
    ['Mileage (highway)', specs.mileageHighway, 'km/l'],
    ['Mileage (combined)', specs.mileageCombined, 'km/l'],
    ['Fuel tank', specs.fuelCapLitres, 'L'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Fuel className="h-5 w-5" />} items={items} title="Performance & economy" />
  );
}

function BodySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Body type', specs.bodyType],
    ['Seating capacity', specs.seatingCapacity],
    ['Doors', specs.doors],
  ]);

  if (items.length === 0) return null;

  return <SpecCard icon={<Car className="h-5 w-5" />} items={items} title="Body & comfort" />;
}

function TyresSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Tyre size', specs.tyreSize],
    ['Wheel type', specs.wheelType],
    ['Wheel size', specs.wheelSizeInch, '"'],
  ]);

  if (items.length === 0) return null;

  return <SpecCard icon={<CircleDot className="h-5 w-5" />} items={items} title="Tyres & wheels" />;
}

function SafetySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([['Airbags', specs.airbagCount]]);

  if (specs.safetyFeatures) {
    try {
      const features = JSON.parse(specs.safetyFeatures) as string[];
      features.forEach((f) => items.push({ label: f, value: '✓' }));
    } catch {
      items.push({ label: 'Safety features', value: specs.safetyFeatures });
    }
  }

  if (items.length === 0) return null;

  return <SpecCard icon={<ShieldCheck className="h-5 w-5" />} items={items} title="Safety" />;
}

type SpecItem = { label: string; value: string };

function buildSpecItems(raw: [string, string | number | null | undefined, string?][]): SpecItem[] {
  return raw
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([label, value, unit]) => ({
      label,
      value: unit ? `${value} ${unit}` : String(value),
    }));
}

type SpecCardProps = {
  title: string;
  icon: React.ReactNode;
  items: SpecItem[];
};

function SpecCard({ title, icon, items }: SpecCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lead">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div className="rounded-2xl border border-border/70 bg-page/80 p-3" key={item.label}>
              <Figure label={item.label} value={item.value} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
