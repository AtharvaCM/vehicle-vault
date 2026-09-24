/**
 * Where the design-system lint rules are errors. Everywhere else under src they
 * are warnings, so the codebase can move onto the tokens one area at a time:
 * each migration slice adds its area here in the same PR that migrates it, and
 * from then on CI fails if the area regresses.
 */
export const MIGRATED_PATHS = [
  'src/styles/**',
  'src/lib/**',
  'src/components/ui/**',
  'src/components/shared/**',
  'src/features/auth/**',
  'src/features/landing/**',
  'src/features/public-catalog/**',
  'src/features/catalog-intent/**',
  'src/components/errors/**',
  'src/components/layout/**',
  'src/features/dashboard/**',
  'src/features/analytics/**',
  'src/features/vehicles/**',
  'src/features/maintenance/**',
  'src/features/service-baseline/**',
  'src/features/reminders/**',
  'src/features/fuel-logs/**',
  'src/features/tyres/**',
  'src/features/accessories/**',
  'src/features/attachments/**',
  'src/features/vehicle-documents/**',
  'src/features/loans/**',
  'src/features/claims/**',
  'src/features/vehicle-sharing/**',
  'src/features/audit/**',
  'src/features/notifications/**',
  'src/features/settings/**',
  'src/features/admin/**',
  'src/features/pwa/**',
];

/**
 * Screens moved onto the status and figure components (#246) before the rest of
 * their area migrates: uppercase micro-labels are errors here already, while
 * the other rules stay warnings until the area's migration slice. Empty since
 * #248 moved the dashboard and vehicle overview onto MIGRATED_PATHS; kept for
 * the next screen that needs it.
 */
export const NO_MICRO_LABEL_PATHS = [];

/** The one place uppercase, tracked figure labels are allowed (the Figure component, #246). */
export const MICRO_LABEL_ALLOWED = ['src/components/shared/figure.tsx'];
