import type { PublicCatalogSchedule } from '@vehicle-vault/shared';

import { formatMaintenanceCategory } from '@/features/maintenance/utils/format-maintenance-category';

import { describeInterval, describeScheduleBasis } from '../utils/format-public-catalog';

type PublicServiceScheduleProps = {
  schedule: PublicCatalogSchedule;
  /** In place of the basis heading, for a page showing one of several variants' schedules. */
  heading?: string;
  /** A line after the usual one, saying whose schedule this is. */
  note?: string;
};

/**
 * What the variant needs and how often. The heading says whose schedule this
 * is: the variant's own intervals when the catalog has them, otherwise a
 * typical one for its type and fuel — most pages are the second kind, and
 * nobody should read it as the maker's.
 */
export function PublicServiceSchedule({ schedule, heading, note }: PublicServiceScheduleProps) {
  return (
    <section
      aria-labelledby="service-schedule-heading"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2
        className="text-lg font-semibold tracking-tight text-slate-950"
        id="service-schedule-heading"
      >
        {heading ?? describeScheduleBasis(schedule)}
      </h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        {schedule.basis === 'variant'
          ? 'Intervals recorded for this variant. Your owner’s manual has the final word.'
          : 'Common intervals for vehicles of this type and fuel, not this maker’s own figures. Check your owner’s manual.'}
      </p>
      {note ? <p className="mt-1 text-sm leading-6 text-slate-600">{note}</p> : null}
      <ul className="mt-4 divide-y divide-slate-100">
        {schedule.items.map((item) => (
          <li
            className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            key={item.category}
          >
            <span className="text-sm font-medium text-slate-900">
              {formatMaintenanceCategory(item.category)}
            </span>
            <span className="text-sm text-slate-600">{describeInterval(item)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
