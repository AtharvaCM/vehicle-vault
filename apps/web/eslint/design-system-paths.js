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
];

/**
 * Files inside MIGRATED_PATHS that belong to a later slice and stay warnings
 * until it lands: the tyre tracker moves with the tyres area (#249), the
 * protection tab with papers (#250). Each slice removes its own entry.
 */
export const MIGRATION_PENDING_PATHS = [
  'src/features/vehicles/components/vehicle-tyre-tracker.tsx',
  'src/features/vehicles/components/protection-tab.tsx',
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
