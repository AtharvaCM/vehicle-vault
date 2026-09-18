import type { AlertKind } from '@vehicle-vault/shared';

export type AlertKindCopy = { label: string; description: string };

/**
 * How each alert kind is named where people choose how it reaches them. A
 * `Record` over every kind, so a kind added to the API cannot go unlisted.
 */
export const ALERT_KIND_COPY: Record<AlertKind, AlertKindCopy> = {
  'maintenance-due': {
    label: 'Service coming up',
    description: 'A service is within 500 km of falling due.',
  },
  'maintenance-overdue': {
    label: 'Service overdue',
    description: 'A service is past its interval.',
  },
  'service-baseline-unknown': {
    label: 'Service history missing',
    description: 'Nobody has told the app when something was last done, so it asks.',
  },
  'reminder-due': {
    label: 'Reminder coming up',
    description: 'A reminder is within 7 days or 500 km of its due point.',
  },
  'reminder-overdue': {
    label: 'Reminder overdue',
    description: 'A reminder’s date or odometer mark has passed.',
  },
  'document-expiring': {
    label: 'Document expiring',
    description: 'Insurance, warranty, PUC, registration or road tax ends within 7 days.',
  },
  'accessory-warranty-expiring': {
    label: 'Accessory warranty ending',
    description: 'The warranty on something you bought for the vehicle ends within 7 days.',
  },
  'tyre-worn': {
    label: 'Tyre worn',
    description: 'A tyre’s tread is near or below the legal minimum.',
  },
  'tyre-aged': {
    label: 'Tyre aged',
    description: 'A tyre is old enough to replace, however much tread it has left.',
  },
  'tyre-uninspected': {
    label: 'Tyre check due',
    description: 'The tyres have not been measured in a while, or none are recorded.',
  },
};

/** Grouped the way people think about their vehicle, not the way the engine raises alerts. */
export const ALERT_KIND_GROUPS: { title: string; kinds: AlertKind[] }[] = [
  {
    title: 'Service',
    kinds: ['maintenance-due', 'maintenance-overdue', 'service-baseline-unknown'],
  },
  { title: 'Reminders', kinds: ['reminder-due', 'reminder-overdue'] },
  {
    title: 'Documents and warranties',
    kinds: ['document-expiring', 'accessory-warranty-expiring'],
  },
  { title: 'Tyres', kinds: ['tyre-worn', 'tyre-aged', 'tyre-uninspected'] },
];
