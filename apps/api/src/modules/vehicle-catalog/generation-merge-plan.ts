/**
 * Planning the merge of duplicate "current" generations.
 *
 * Several sources feed one model: an official-site snapshot names the real
 * generation with its years ("Amaze (2024 refresh)", 2024–), the CarWale scrape
 * files its trims under a placeholder with no years ("Amaze (current)"), and
 * the curated seed adds another ("Amaze lineup"). All three are the same car,
 * so a model page showed three generations marked current.
 *
 * This module decides, for one catalog address at a time, which placeholder generations
 * fold into which generation and what happens to each of their variants. It is
 * pure: the CLI (`catalog:merge-duplicate-generations`) loads the rows, calls
 * `planGenerationMerge`, and applies the plan.
 */

export type MergeVariantRow = { id: string; name: string; slug: string };

export type MergeGenerationRow = {
  id: string;
  name: string;
  slug: string;
  yearStart: number | null;
  yearEnd: number | null;
  isCurrent: boolean;
  variants: MergeVariantRow[];
};

/**
 * One catalog address: the model rows that share a make and model slug across
 * the make rows of one segment (the CarWale scrape files the Honda Elevate as a
 * car, Honda's own site as an SUV), with all their generations together.
 */
export type MergeModelRow = {
  id: string;
  /** "Honda Amaze", for reports. */
  label: string;
  /** The model rows behind this address; one when the sources agree on body type. */
  modelIds?: string[];
  generations: MergeGenerationRow[];
};

/** A placeholder variant becomes part of the generation that absorbs it. */
export type VariantMove = {
  variantId: string;
  variantName: string;
  toGenerationId: string;
};

/**
 * A placeholder variant whose slug already exists in the model: it folds into
 * that variant (offerings, specs, aliases, intervals, linked vehicles) and is
 * then deleted.
 */
export type VariantFold = {
  variantId: string;
  variantName: string;
  intoVariantId: string;
  intoGenerationId: string;
};

export type GenerationMergePlan = {
  kind: 'merge';
  modelId: string;
  label: string;
  /** Model rows left with no generations are deleted after the merge. */
  modelIds: string[];
  into: { id: string; name: string };
  /** Deleted once empty; each name is kept as an alias of `into`. */
  absorbed: Array<{ id: string; name: string }>;
  moves: VariantMove[];
  folds: VariantFold[];
};

export type GenerationMergeSkip = {
  kind: 'skip';
  modelId: string;
  label: string;
  reason: 'several-real-current-generations';
  /** The current generations, for the report. */
  generations: string[];
};

export type GenerationMergeDecision = GenerationMergePlan | GenerationMergeSkip | null;

/**
 * A generation a source made up rather than named: current, with no years at
 * all, and called "<model> (current)" (the CarWale scrape) or "<model> lineup"
 * (the curated seed). A real generation has at least one year.
 */
export function isPlaceholderGeneration(generation: MergeGenerationRow): boolean {
  if (!generation.isCurrent) return false;
  if (generation.yearStart !== null || generation.yearEnd !== null) return false;
  return /\(current\)$/i.test(generation.name.trim()) || /\blineup$/i.test(generation.name.trim());
}

/** CarWale's "(current)" placeholder carries the most trims, so it goes first. */
function placeholderRank(generation: MergeGenerationRow): number {
  return /\(current\)$/i.test(generation.name.trim()) ? 0 : 1;
}

/**
 * The plan for one model, or null when it has nothing to merge.
 *
 * - With exactly one real current generation, every placeholder folds into it.
 * - With none, placeholders fold into one of themselves, the CarWale one first.
 * - With two or more real current generations (TVS sells the Jupiter 110 and
 *   125 side by side), which one a placeholder belongs to is a judgement call,
 *   so the model is skipped and reported.
 *
 * A placeholder variant whose slug already exists elsewhere in the model folds
 * into that variant, in whichever generation it lives: "4th Gen V" in "City
 * lineup" belongs with the 4th-generation City, not the current one. Any other
 * variant moves into the absorbing generation.
 */
export function planGenerationMerge(model: MergeModelRow): GenerationMergeDecision {
  const current = model.generations.filter((generation) => generation.isCurrent);
  const placeholders = current
    .filter(isPlaceholderGeneration)
    .sort((a, b) => placeholderRank(a) - placeholderRank(b) || a.name.localeCompare(b.name));
  const real = current.filter((generation) => !isPlaceholderGeneration(generation));

  if (current.length < 2 || placeholders.length === 0) return null;

  if (real.length > 1) {
    return {
      kind: 'skip',
      modelId: model.id,
      label: model.label,
      reason: 'several-real-current-generations',
      generations: current.map((generation) => generation.name),
    };
  }

  const into = real[0] ?? placeholders[0]!;
  const absorbed = placeholders.filter((generation) => generation.id !== into.id);
  const absorbedIds = new Set(absorbed.map((generation) => generation.id));

  // Where each slug lives once the merge is done: first the generations that
  // stay, then whatever has already moved into `into`.
  const home = new Map<string, { variantId: string; generationId: string }>();
  for (const generation of model.generations) {
    if (absorbedIds.has(generation.id)) continue;
    for (const variant of generation.variants) {
      // `into` claims its own slugs before any other generation does.
      if (!home.has(variant.slug) || generation.id === into.id) {
        home.set(variant.slug, { variantId: variant.id, generationId: generation.id });
      }
    }
  }

  const moves: VariantMove[] = [];
  const folds: VariantFold[] = [];

  for (const generation of absorbed) {
    for (const variant of [...generation.variants].sort((a, b) => a.slug.localeCompare(b.slug))) {
      const existing = home.get(variant.slug);
      if (existing) {
        folds.push({
          variantId: variant.id,
          variantName: variant.name,
          intoVariantId: existing.variantId,
          intoGenerationId: existing.generationId,
        });
      } else {
        moves.push({ variantId: variant.id, variantName: variant.name, toGenerationId: into.id });
        home.set(variant.slug, { variantId: variant.id, generationId: into.id });
      }
    }
  }

  return {
    kind: 'merge',
    modelId: model.id,
    label: model.label,
    modelIds: model.modelIds ?? [model.id],
    into: { id: into.id, name: into.name },
    absorbed: absorbed.map(({ id, name }) => ({ id, name })),
    moves,
    folds,
  };
}
