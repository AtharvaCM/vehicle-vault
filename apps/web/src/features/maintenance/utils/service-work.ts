import { MaintenanceCategory, ReminderType, type Reminder } from '@vehicle-vault/shared';

import { format } from '@/lib/format';

/** The one-tap chips of the log-service form, in the order the design draws them. */
export const CATEGORY_CHIPS: readonly { category: MaintenanceCategory; label: string }[] = [
  { category: MaintenanceCategory.EngineOil, label: 'Oil change' },
  { category: MaintenanceCategory.PeriodicService, label: 'Periodic service' },
  { category: MaintenanceCategory.BrakePads, label: 'Brakes' },
  { category: MaintenanceCategory.TyreRotation, label: 'Tyres' },
  { category: MaintenanceCategory.Battery, label: 'Battery' },
];

const CATEGORY_VALUES = new Set<string>(Object.values(MaintenanceCategory));

/** What a chip says for a category: its chip label, else its sentence-case name. */
export function categoryChipLabel(category: MaintenanceCategory): string {
  return (
    CATEGORY_CHIPS.find((chip) => chip.category === category)?.label ??
    format.enumLabel('maintenanceCategory', category)
  );
}

/** The work, as a sentence reads it: "the oil change is due today", "Next oil change". */
const WORK_NAME: Partial<Record<MaintenanceCategory, string>> = {
  [MaintenanceCategory.EngineOil]: 'oil change',
  [MaintenanceCategory.OilFilter]: 'oil filter change',
  [MaintenanceCategory.AirFilter]: 'air filter change',
  [MaintenanceCategory.BrakePads]: 'brake pad check',
  [MaintenanceCategory.Battery]: 'battery check',
  [MaintenanceCategory.Coolant]: 'coolant change',
  [MaintenanceCategory.TimingBelt]: 'timing belt change',
  [MaintenanceCategory.SparkPlug]: 'spark plug change',
  [MaintenanceCategory.CvtBelt]: 'CVT belt change',
  [MaintenanceCategory.Other]: 'service',
};

export function workName(category: MaintenanceCategory): string {
  const named = WORK_NAME[category];
  if (named) return named;

  const label = format.enumLabel('maintenanceCategory', category);
  // Lower the first letter unless the first word is an acronym (PUC).
  const [firstWord = ''] = label.split(' ');
  return firstWord.length > 1 && firstWord === firstWord.toUpperCase()
    ? label
    : `${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** A `?category=` value: a maintenance category as the API names it (`engine_oil`), or nothing. */
export function parseCategorySlug(value: unknown): MaintenanceCategory | undefined {
  return typeof value === 'string' && CATEGORY_VALUES.has(value)
    ? (value as MaintenanceCategory)
    : undefined;
}

/**
 * The service-schedule items (the API's `service-schedule-catalog.ts`) that
 * stand for a kind of work. A reminder applied from the schedule carries one.
 */
const CATEGORY_FOR_SCHEDULE_SLUG: Record<string, MaintenanceCategory> = {
  engine_oil_change: MaintenanceCategory.EngineOil,
  tyre_rotation: MaintenanceCategory.TyreRotation,
  brake_inspection: MaintenanceCategory.BrakePads,
  coolant_flush: MaintenanceCategory.Coolant,
  air_filter: MaintenanceCategory.AirFilter,
  battery_check: MaintenanceCategory.Battery,
  spark_plug: MaintenanceCategory.SparkPlug,
  cvt_belt: MaintenanceCategory.CvtBelt,
  chain_lube: MaintenanceCategory.ChainService,
};

/**
 * The title the API gives the reminder a service record leaves behind
 * (`nextDueTitle` in `maintenance/next-due-reminder.ts`): "Engine oil due".
 */
function nextDueTitle(category: MaintenanceCategory) {
  if (category === MaintenanceCategory.Other) return 'Service due';
  const words = category.replace(/_/g, ' ');
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} due`;
}

// "Service due" is left out: it reads the same written by hand, and a
// hand-written service reminder is taken as a periodic service below.
const CATEGORY_FOR_NEXT_DUE_TITLE = new Map(
  Object.values(MaintenanceCategory)
    .filter((category) => category !== MaintenanceCategory.Other)
    .map((category) => [nextDueTitle(category), category]),
);

export type ReminderWork = {
  category: MaintenanceCategory;
  /** How a sentence names it: "the oil change", or a hand-written reminder's own title in quotes. */
  phrase: string;
};

/**
 * The kind of work a reminder asks for, so logging it can start on that
 * category: the schedule item it was applied from, else the service record it
 * was left by (known by its title), else its type. A hand-written service
 * reminder is a periodic service, named by its own title; a renewal or any
 * other reminder is not work done at a workshop and has none.
 */
export function reminderWork(
  reminder: Pick<Reminder, 'type' | 'title' | 'catalogSlug'>,
): ReminderWork | undefined {
  const named = (category: MaintenanceCategory) => ({
    category,
    phrase: `the ${workName(category)}`,
  });

  const fromSchedule = reminder.catalogSlug
    ? CATEGORY_FOR_SCHEDULE_SLUG[reminder.catalogSlug]
    : undefined;
  if (fromSchedule) return named(fromSchedule);

  const fromRecord = CATEGORY_FOR_NEXT_DUE_TITLE.get(reminder.title.trim());
  if (fromRecord) return named(fromRecord);

  switch (reminder.type) {
    case ReminderType.TyreRotation:
      return named(MaintenanceCategory.TyreRotation);
    case ReminderType.Battery:
      return named(MaintenanceCategory.Battery);
    case ReminderType.Service:
      return {
        category: MaintenanceCategory.PeriodicService,
        phrase: `“${reminder.title.trim()}”`,
      };
    default:
      return undefined;
  }
}
