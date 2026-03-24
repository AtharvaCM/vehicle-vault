import {
  Car,
  Compass,
  Fuel,
  Gauge,
  Ruler,
  ShieldCheck,
  Users,
  Weight,
  CircleDot,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';

import type { VehicleVariantSpec } from '../hooks/use-variant-specs';
import { useVariantSpecs } from '../hooks/use-variant-specs';

type VehicleSpecsCardProps = {
  make: string;
  model: string;
  variant: string;
};

export function VehicleSpecsCard({ make, model, variant }: VehicleSpecsCardProps) {
  const specsQuery = useVariantSpecs(make, model, variant);

  if (specsQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Specifications</CardTitle>
          <CardDescription>Loading specs for {make} {model} {variant}…</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Looking up specifications…
          </p>
        </CardContent>
      </Card>
    );
  }

  if (specsQuery.isError || !specsQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vehicle Specifications</CardTitle>
          <CardDescription>Specifications for {make} {model} {variant}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            description="Specs for this variant haven't been added to the catalog yet. They'll appear here once available."
            title="No specifications available"
          />
        </CardContent>
      </Card>
    );
  }

  const specs = specsQuery.data;

  return (
    <div className="space-y-6">
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
    ['Engine Type', specs.engineType],
    ['Fuel', specs.engineFuel],
    ['Max Power', specs.powerPs, specs.powerRpm ? `PS @ ${specs.powerRpm} rpm` : 'PS'],
    ['Max Torque', specs.torqueNm, specs.torqueRpm ? `Nm @ ${specs.torqueRpm} rpm` : 'Nm'],
    ['Transmission', specs.transmission],
    ['Drivetrain', specs.driveType],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Gauge className="h-5 w-5" />} items={items} title="Engine & Drivetrain" />
  );
}

function DimensionsSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Length', specs.lengthMm, 'mm'],
    ['Width', specs.widthMm, 'mm'],
    ['Height', specs.heightMm, 'mm'],
    ['Wheelbase', specs.wheelbaseMm, 'mm'],
    ['Kerb Weight', specs.kerbWeightKg, 'kg'],
    ['Gross Weight', specs.grossWeightKg, 'kg'],
    ['Boot Space', specs.bootSpaceLitres, 'L'],
    ['Ground Clearance', specs.groundClearanceMm, 'mm'],
    ['Turning Radius', specs.turningRadiusM, 'm'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Ruler className="h-5 w-5" />} items={items} title="Dimensions & Weight" />
  );
}

function PerformanceSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Top Speed', specs.topSpeedKph, 'km/h'],
    ['Mileage (City)', specs.mileageCity, 'km/l'],
    ['Mileage (Highway)', specs.mileageHighway, 'km/l'],
    ['Mileage (Combined)', specs.mileageCombined, 'km/l'],
    ['Fuel Tank', specs.fuelCapLitres, 'L'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Fuel className="h-5 w-5" />} items={items} title="Performance & Economy" />
  );
}

function BodySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Body Type', specs.bodyType],
    ['Seating Capacity', specs.seatingCapacity],
    ['Doors', specs.doors],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Car className="h-5 w-5" />} items={items} title="Body & Comfort" />
  );
}

function TyresSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Tyre Size', specs.tyreSize],
    ['Wheel Type', specs.wheelType],
    ['Wheel Size', specs.wheelSizeInch, '"'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<CircleDot className="h-5 w-5" />} items={items} title="Tyres & Wheels" />
  );
}

function SafetySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Airbags', specs.airbagCount],
  ]);

  if (specs.safetyFeatures) {
    try {
      const features = JSON.parse(specs.safetyFeatures) as string[];
      features.forEach((f) => items.push({ label: f, value: '✓' }));
    } catch {
      items.push({ label: 'Safety Features', value: specs.safetyFeatures });
    }
  }

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<ShieldCheck className="h-5 w-5" />} items={items} title="Safety" />
  );
}

type SpecItem = { label: string; value: string };

function buildSpecItems(
  raw: [string, string | number | null | undefined, string?][],
): SpecItem[] {
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
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              className="rounded-2xl border border-border/70 bg-slate-50/80 p-3"
              key={item.label}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1.5 text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
