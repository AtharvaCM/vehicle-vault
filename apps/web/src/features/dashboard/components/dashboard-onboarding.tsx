import { Link } from '@tanstack/react-router';
import { CarFront } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STEPS = [
  {
    title: 'Add a vehicle',
    description: "Make, model, registration number, and today's odometer.",
  },
  {
    title: 'Enter insurance and PUC dates',
    description: 'So expiry shows up here weeks before it lapses.',
  },
  {
    title: 'Log the last service',
    description: 'Next-due suggestions start from the most recent visit.',
  },
] as const;

export function DashboardOnboarding() {
  return (
    <Card className="border-slate-200/60 bg-white/70 shadow-premium-sm sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 shadow-inner">
          <CarFront aria-hidden="true" className="h-7 w-7" />
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Set up your garage
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-500">
              Add the first vehicle — yours or a family member&apos;s. Reminders, insurance and PUC
              dates, and service history all hang off each vehicle.
            </p>
            <div className="pt-1">
              <Link className={buttonVariants()} to="/vehicles/new">
                Add vehicle
              </Link>
            </div>
          </div>

          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li className="flex gap-3" key={step.title}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold tabular-nums text-white">
                  {index + 1}
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                  <p className="text-[13px] leading-5 text-slate-500">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
