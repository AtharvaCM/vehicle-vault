import { DueLine } from '@/components/shared/due-line';
import { VehicleIdentity } from '@/components/shared/vehicle-identity';
import { Badge } from '@/components/ui/badge';

type PreviewRow = {
  title: string;
  badge: string;
  vehicle: { name: string; registration: string };
  /** Days from today: negative is late. */
  days: number;
  mode: 'due' | 'ends';
};

const ROWS: PreviewRow[] = [
  {
    title: 'Insurance policy',
    badge: 'Policy',
    vehicle: { name: 'Family SUV', registration: 'MH12AB1234' },
    days: -3,
    mode: 'ends',
  },
  {
    title: 'Oil change',
    badge: 'Service',
    vehicle: { name: 'Daily scooter', registration: 'MH14CD5678' },
    days: 0,
    mode: 'due',
  },
  {
    title: 'PUC certificate',
    badge: 'PUC',
    vehicle: { name: 'Family SUV', registration: 'MH12AB1234' },
    days: 5,
    mode: 'ends',
  },
];

function daysFromToday(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * The hero's picture of the product (#342): Home's "Needs attention" list,
 * built from the app's own parts with dates counted from today, so it reads as
 * the real thing at any width instead of a shrunken screenshot. Not a control.
 */
export function AttentionPreview() {
  return (
    <figure
      aria-label="An example of the Needs attention list on Home"
      className="overflow-hidden rounded-card border border-line bg-surface shadow-sm"
      data-testid="attention-preview"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
        <p className="font-display text-body font-semibold text-fg">Needs attention</p>
        <span className="rounded-full bg-late-tint px-2 py-0.5 text-caption font-semibold text-late tabular-nums">
          {ROWS.length}
        </span>
      </div>
      <ul className="divide-y divide-line-subtle">
        {ROWS.map((row) => (
          <li className="px-5 py-3" key={row.title}>
            <VehicleIdentity
              className="mb-1"
              layout="row"
              name={row.vehicle.name}
              registration={row.vehicle.registration}
            />
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate font-semibold text-fg">{row.title}</p>
              <Badge className="shrink-0 bg-surface text-caption" variant="outline">
                {row.badge}
              </Badge>
            </div>
            <DueLine
              className="mt-1"
              date={daysFromToday(row.days)}
              days={row.days}
              mode={row.mode}
            />
          </li>
        ))}
      </ul>
    </figure>
  );
}
