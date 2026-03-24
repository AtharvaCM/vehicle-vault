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
import { cn } from '@/lib/utils/cn';

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
      <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm">
        <CardHeader className="pb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 animate-pulse items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Gauge className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold">Retrieving Specifications</CardTitle>
          <CardDescription>Analyzing technical data for {make} {model}…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (specsQuery.isError || !specsQuery.data) {
    return (
      <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Vehicle Specifications</CardTitle>
          <CardDescription>Catalog details for {make} {model} {variant}</CardDescription>
        </CardHeader>
        <CardContent className="pb-10 pt-4">
          <EmptyState
            description="Detailed specifications for this variant are currently being cataloged. They will appear here automatically once verified."
            title="Specs Under Review"
          />
        </CardContent>
      </Card>
    );
  }

  const specs = specsQuery.data;

  return (
    <div className="space-y-8 pb-10">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <EngineSection specs={specs} />
        <PerformanceSection specs={specs} />
        <FuelEconomySection specs={specs} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-8">
          <DimensionsSection specs={specs} />
          <SafetySection specs={specs} />
        </div>
        <div className="space-y-8">
          <BodySection specs={specs} />
          <TyresSection specs={specs} />
        </div>
      </div>
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
    ['Fuel Type', specs.engineFuel],
    ['Transmission', specs.transmission],
    ['Drivetrain', specs.driveType],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Gauge className="h-4 w-4" />} items={items} title="Engine & Drivetrain" />
  );
}

function PerformanceSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Max Power', specs.powerPs, specs.powerRpm ? `PS @ ${specs.powerRpm} rpm` : 'PS'],
    ['Max Torque', specs.torqueNm, specs.torqueRpm ? `Nm @ ${specs.torqueRpm} rpm` : 'Nm'],
    ['Top Speed', specs.topSpeedKph, 'km/h'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard 
      icon={< Compass className="h-4 w-4" />} 
      items={items} 
      title="Performance"
      variant="primary"
    />
  );
}

function FuelEconomySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['City Mileage', specs.mileageCity, 'km/l'],
    ['Highway Mileage', specs.mileageHighway, 'km/l'],
    ['Combined', specs.mileageCombined, 'km/l'],
    ['Fuel Tank', specs.fuelCapLitres, 'L'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Fuel className="h-4 w-4" />} items={items} title="Economy" />
  );
}

function DimensionsSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Length', specs.lengthMm, 'mm'],
    ['Width', specs.widthMm, 'mm'],
    ['Height', specs.heightMm, 'mm'],
    ['Wheelbase', specs.wheelbaseMm, 'mm'],
    ['Kerb Weight', specs.kerbWeightKg, 'kg'],
    ['Ground Clearance', specs.groundClearanceMm, 'mm'],
    ['Boot Space', specs.bootSpaceLitres, 'L'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Ruler className="h-4 w-4" />} items={items} title="Dimensions" columns={3} />
  );
}

function SafetySection({ specs }: SpecSectionProps) {
  const items: SpecItem[] = [];
  
  if (specs.airbagCount) {
    items.push({ label: 'Airbags', value: String(specs.airbagCount) });
  }

  if (specs.safetyFeatures) {
    try {
      const features = JSON.parse(specs.safetyFeatures) as string[];
      features.forEach((f) => items.push({ label: f, value: 'Included' }));
    } catch {
      items.push({ label: 'Safety Systems', value: specs.safetyFeatures });
    }
  }

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<ShieldCheck className="h-4 w-4" />} items={items} title="Safety Systems" columns={3} />
  );
}

function BodySection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Body Type', specs.bodyType],
    ['Seating', specs.seatingCapacity, 'Seats'],
    ['Doors', specs.doors],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Car className="h-4 w-4" />} items={items} title="Body Configuration" />
  );
}

function TyresSection({ specs }: SpecSectionProps) {
  const items = buildSpecItems([
    ['Tyre Profile', specs.tyreSize],
    ['Wheel Type', specs.wheelType],
    ['Wheel Diameter', specs.wheelSizeInch, 'inch'],
  ]);

  if (items.length === 0) return null;

  return (
    <SpecCard icon={<Weight className="h-4 w-4" />} items={items} title="Wheels & Tyres" />
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
  variant?: 'default' | 'primary';
  columns?: 2 | 3;
};

function SpecCard({ title, icon, items, variant = 'default', columns = 2 }: SpecCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden border-slate-200/60 shadow-premium-sm transition-all hover:shadow-premium-md",
      variant === 'primary' ? "bg-slate-900 text-white" : "bg-white/70"
    )}>
      <CardHeader className={cn(
        "flex flex-row items-center gap-3 border-b pb-4 pt-4",
        variant === 'primary' ? "border-slate-800" : "border-slate-100"
      )}>
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shadow-inner",
          variant === 'primary' ? "bg-slate-800 text-primary" : "bg-slate-50 text-slate-500"
        )}>
          {icon}
        </div>
        <CardTitle className="text-[15px] font-bold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className={cn(
          "grid divide-slate-100",
          columns === 2 ? "grid-cols-2 divide-x" : "grid-cols-2 lg:grid-cols-3 divide-x divide-y lg:divide-y-0"
        )}>
          {items.map((item, idx) => (
            <div
              className={cn(
                "group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-slate-50",
                variant === 'primary' && "hover:bg-slate-800/50",
                idx >= columns && !columns ? "border-t border-slate-100" : ""
              )}
              key={item.label}
            >
              <p className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                variant === 'primary' ? "text-slate-500" : "text-slate-400"
              )}>
                {item.label}
              </p>
              <p className={cn(
                "text-[13px] font-semibold",
                variant === 'primary' ? "text-white" : "text-slate-800"
              )}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
