/**
 * Where the design-system lint rules are errors. Everywhere else under src they
 * are warnings, so the codebase can move onto the tokens one area at a time:
 * each migration slice adds its area here in the same PR that migrates it, and
 * from then on CI fails if the area regresses.
 */
export const MIGRATED_PATHS = ['src/styles/**', 'src/lib/**', 'src/components/ui/**'];

/** The one place uppercase, tracked figure labels are allowed (the Figure component, #246). */
export const MICRO_LABEL_ALLOWED = ['src/components/shared/figure.tsx'];
