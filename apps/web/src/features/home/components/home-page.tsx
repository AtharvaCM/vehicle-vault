import { APP_NAME, VehicleType } from '@vehicle-vault/shared';

import { Badge } from '@/components/ui/badge';
import { useAppTitle } from '@/hooks/use-app-title';

const vehicleTypes = Object.values(VehicleType);

export function HomePage() {
  useAppTitle(APP_NAME);

  return (
    <section className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Badge tone="accent">MVP Foundation</Badge>
        <div className="space-y-4">
          <h1 className="text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">
            {APP_NAME}
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-600">
            A production-minded monorepo starter for tracking vehicles, service history, reminders,
            and maintenance workflows without carrying heavyweight infrastructure too early.
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-panel backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
          Supported starter vehicle types
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {vehicleTypes.map((vehicleType) => (
            <Badge key={vehicleType}>{vehicleType}</Badge>
          ))}
        </div>
      </div>
    </section>
  );
}
