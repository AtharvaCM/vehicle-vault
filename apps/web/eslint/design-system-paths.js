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
];

/**
 * Screens moved onto the status and figure components (#246) before the rest of
 * their area migrates: uppercase micro-labels are errors here already, while
 * the other rules stay warnings until the area's migration slice.
 */
export const NO_MICRO_LABEL_PATHS = [
  'src/features/dashboard/**',
  'src/features/vehicles/pages/vehicle-detail-page.tsx',
  'src/features/vehicles/components/odometer-forecast-card.tsx',
  'src/features/vehicles/components/odometer-history-card.tsx',
  'src/features/vehicles/components/service-trend-card.tsx',
  'src/features/vehicles/components/vehicle-summary-card.tsx',
  'src/features/analytics/components/tco-card.tsx',
];

/** The one place uppercase, tracked figure labels are allowed (the Figure component, #246). */
export const MICRO_LABEL_ALLOWED = ['src/components/shared/figure.tsx'];
