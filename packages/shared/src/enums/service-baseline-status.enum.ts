/**
 * What a **ServiceBaseline** row asserts about one service category.
 *
 * The absence of a row is a third state and is deliberately not modelled here:
 * "nobody has been asked" is not the same claim as "the owner does not know",
 * and only the second one is worth raising an alert about.
 */
export enum ServiceBaselineStatus {
  Known = 'known',
  Unknown = 'unknown',
}
