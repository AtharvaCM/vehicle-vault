/**
 * Planning the merge of near-duplicate trims inside one generation.
 *
 * After duplicate generations were merged, one generation can hold the same
 * trim twice under different names, because the CarWale scrape names trims its
 * own way:
 *
 * - **Model-prefixed.** CarWale repeats part of the model name: "3XO AX5" beside
 *   the official "AX5" in the Mahindra XUV 3XO, "Hycross ZX (O)" beside "ZX (O)".
 *   Same trim; the clean name survives.
 * - **Parent of detailed trims.** Honda's own site lists "V"; CarWale splits it
 *   into "V | Petrol | Manual" and "V | Petrol | Automatic". The bare "V" says
 *   nothing its children don't, so it folds into the first of them.
 *
 * Names that only share a prefix ("SX" and "SX (O)", "Asta" and "Asta (O)") are
 * different trims and are left alone. Pure: the CLI
 * (`catalog:merge-near-duplicate-trims`) loads each generation, calls
 * `planTrimMerges`, and folds each pair.
 */

export type TrimRow = { id: string; name: string };

export type TrimFold = {
  variantId: string;
  variantName: string;
  intoVariantId: string;
  intoVariantName: string;
  reason: 'model-prefixed' | 'parent-of-detailed';
};

/** Lower case, punctuation as single spaces: "ZX (O)" and "zx o" compare equal. */
export function normalizeTrimName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** "V | Petrol | Manual" → "V"; null for a name with no detail segments. */
export function detailedTrimRoot(name: string): string | null {
  if (!name.includes('|')) return null;
  const root = name.split('|')[0]!.trim();
  return root.length > 0 ? root : null;
}

/**
 * The trims to fold in one generation of `modelName`. A trim is folded at most
 * once and never into a trim that is itself folded away.
 */
export function planTrimMerges(modelName: string, trims: TrimRow[]): TrimFold[] {
  const byNormalized = new Map<string, TrimRow>();
  for (const trim of trims) {
    const key = normalizeTrimName(trim.name);
    if (key && !byNormalized.has(key)) byNormalized.set(key, trim);
  }

  // "Grand i10 Nios" can be echoed as "grand i10 nios", "i10 nios" or "nios".
  const modelTokens = normalizeTrimName(modelName).split(' ').filter(Boolean);
  const modelPrefixes = modelTokens.map((_, index) => modelTokens.slice(index).join(' '));

  const folds: TrimFold[] = [];
  const foldedAway = new Set<string>();

  for (const trim of [...trims].sort((a, b) => a.name.localeCompare(b.name))) {
    const normalized = normalizeTrimName(trim.name);
    for (const prefix of modelPrefixes) {
      if (!normalized.startsWith(`${prefix} `)) continue;
      const clean = byNormalized.get(normalized.slice(prefix.length + 1));
      if (clean && clean.id !== trim.id) {
        folds.push({
          variantId: trim.id,
          variantName: trim.name,
          intoVariantId: clean.id,
          intoVariantName: clean.name,
          reason: 'model-prefixed',
        });
        foldedAway.add(trim.id);
      }
      break;
    }
  }

  const children = new Map<string, TrimRow[]>();
  for (const trim of trims) {
    const root = detailedTrimRoot(trim.name);
    if (!root || foldedAway.has(trim.id)) continue;
    const key = normalizeTrimName(root);
    children.set(key, [...(children.get(key) ?? []), trim]);
  }

  for (const trim of trims) {
    if (foldedAway.has(trim.id) || detailedTrimRoot(trim.name)) continue;
    const family = children.get(normalizeTrimName(trim.name));
    if (!family?.length) continue;
    const [first] = [...family].sort((a, b) => a.name.localeCompare(b.name));
    folds.push({
      variantId: trim.id,
      variantName: trim.name,
      intoVariantId: first!.id,
      intoVariantName: first!.name,
      reason: 'parent-of-detailed',
    });
    foldedAway.add(trim.id);
  }

  // A survivor must survive: drop any fold whose target is itself folded away.
  return folds.filter((fold) => !foldedAway.has(fold.intoVariantId));
}

export type TrimRename = {
  variantId: string;
  from: string;
  to: string;
};

/**
 * The model-name tail a trim starts with ("Liva" in "Liva GX" of the Toyota
 * Etios Liva), as the words of the trim's own name so their casing survives, or
 * null. Tails are tried longest first; punctuation is compared loosely.
 */
function modelPrefixWords(modelName: string, trimName: string): number | null {
  const modelTokens = normalizeTrimName(modelName).split(' ').filter(Boolean);
  const words = trimName.trim().split(/\s+/);

  for (let start = 0; start < modelTokens.length; start += 1) {
    const prefix = modelTokens.slice(start).join(' ');
    let consumed = '';
    for (let count = 1; count < words.length; count += 1) {
      consumed = normalizeTrimName(words.slice(0, count).join(' '));
      if (consumed === prefix) return count;
      if (!prefix.startsWith(consumed)) break;
    }
  }
  return null;
}

/**
 * Trims whose names repeat part of the model's ("7 Premium" in the BYD eMax 7,
 * "Cruiser Taisor V" in the Toyota Urban Cruiser Taisor), renamed to the rest
 * ("Premium", "V"). A trim is left alone when nothing would be left, or when
 * the rest is already another trim's name in the generation: that pair is a
 * near-duplicate for `planTrimMerges` to fold, not a rename.
 */
export function planTrimRenames(modelName: string, trims: TrimRow[]): TrimRename[] {
  const taken = new Set(trims.map((trim) => normalizeTrimName(trim.name)));
  const renames: TrimRename[] = [];

  for (const trim of [...trims].sort((a, b) => a.name.localeCompare(b.name))) {
    if (trim.name.trim().startsWith('|')) continue;
    const count = modelPrefixWords(modelName, trim.name);
    if (count === null) continue;

    const to = trim.name.trim().split(/\s+/).slice(count).join(' ');
    const key = normalizeTrimName(to);
    if (!key || taken.has(key)) continue;

    renames.push({ variantId: trim.id, from: trim.name, to });
    taken.add(key);
  }

  return renames;
}
