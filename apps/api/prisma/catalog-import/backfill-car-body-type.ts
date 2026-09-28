/**
 * Fill car body types (#389), which the browse page's body-type chips filter
 * on.
 *
 * For each car model, the body type comes from, in order:
 * 1. the curated table in `src/modules/vehicle-catalog/car-body-type.ts`,
 *    which also corrects CarWale where it is wrong;
 * 2. its CarWale model page's structured data (`sourceUrl`, else CarWale's
 *    address for its slugs);
 * 3. what its own variants already say, when they agree.
 *
 * A variant with no body type gets the model's; one with a source's label
 * ("MuvsMpvs", "CompactSuv") gets the catalog's label for it; one the curated
 * table disagrees with gets the table's. Any other value on file is left
 * alone, so a rerun changes nothing. A variant with no spec row gets one
 * holding just the body type.
 *
 * CarWale is read once per model, a second apart. `--cache` keeps what it
 * said in a JSON file, so the write run can reuse the dry run's answers
 * instead of asking again.
 *
 * Usage:
 *   pnpm catalog:backfill-car-body-type -- --dry-run --cache=body-types.json
 *   pnpm catalog:backfill-car-body-type -- --cache=body-types.json
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { PrismaClient } from '@prisma/client';
import { type CarBodyType, normaliseCarBodyType } from '@vehicle-vault/shared';

import { isPseudoCatalogVariant } from './pseudo-variants';
import {
  carBodyTypeFill,
  carWaleJsonLdBodyType,
  curatedCarBodyType,
} from '../../src/modules/vehicle-catalog/car-body-type';

const CAR_VEHICLE_TYPES = ['car', 'suv', 'van'] as const;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

type Source = 'carwale-jsonld' | 'curated-car-body-type' | 'variants';

/** CarWale's answer per model URL: its raw label, or null when the page gave none. */
type Cache = Record<string, string | null>;

function parseArgs() {
  const cacheArg = process.argv.find((arg) => arg.startsWith('--cache='));
  return {
    dryRun: process.argv.includes('--dry-run'),
    cachePath: cacheArg ? cacheArg.slice('--cache='.length) : null,
  };
}

async function fetchCarWaleBodyType(url: string): Promise<string | null> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return null;
  return carWaleJsonLdBodyType(await response.text());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * CarWale model pages to ask, in order: the model's own `sourceUrl` when it is
 * one, then CarWale's usual address for the make and model slugs, which also
 * covers models imported from a maker's site. CarWale redirects a renamed
 * model to its successor, which keeps the shape.
 */
function carWaleUrls(model: {
  slug: string;
  sourceUrl: string | null;
  make: { slug: string };
}): string[] {
  const urls = [`https://www.carwale.com/${model.make.slug}-cars/${model.slug}/`];
  if (model.sourceUrl?.includes('carwale.com')) {
    urls.unshift(`${model.sourceUrl.replace(/\/$/, '')}/`);
  }
  return [...new Set(urls)];
}

/** The body type every labelled variant agrees on, or null. */
function agreedVariantBodyType(stored: Array<string | null | undefined>): CarBodyType | null {
  const labels = new Set(stored.map(normaliseCarBodyType).filter(Boolean));
  return labels.size === 1 ? ([...labels][0] as CarBodyType) : null;
}

async function main() {
  const args = parseArgs();
  const cache: Cache =
    args.cachePath && existsSync(args.cachePath)
      ? (JSON.parse(readFileSync(args.cachePath, 'utf8')) as Cache)
      : {};
  const prisma = new PrismaClient();
  const counts = { filled: 0, relabelled: 0, corrected: 0, created: 0 };
  const modelsByType = new Map<string, number>();
  const bySource = new Map<Source, number>();
  const uncovered: string[] = [];
  let processed = 0;

  try {
    const models = await prisma.vehicleCatalogModel.findMany({
      where: { make: { vehicleType: { in: [...CAR_VEHICLE_TYPES] } } },
      orderBy: [{ make: { name: 'asc' } }, { name: 'asc' }],
      select: {
        name: true,
        slug: true,
        sourceUrl: true,
        make: { select: { name: true, slug: true } },
        generations: {
          select: {
            variants: {
              select: {
                id: true,
                name: true,
                spec: { select: { id: true, bodyType: true } },
              },
            },
          },
        },
      },
    });

    for (const model of models) {
      const label = `${model.make.name} ${model.name}`;
      const variants = model.generations
        .flatMap((generation) => generation.variants)
        .filter((variant) => !isPseudoCatalogVariant(variant.name));
      if (variants.length === 0) continue;
      processed += 1;

      let bodyType: CarBodyType | null = null;
      let source: Source | null = null;

      bodyType = curatedCarBodyType(model.make.slug, model.slug);
      if (bodyType) source = 'curated-car-body-type';
      for (const url of bodyType ? [] : carWaleUrls(model)) {
        if (!(url in cache)) {
          cache[url] = await fetchCarWaleBodyType(url).catch(() => null);
          await sleep(1000);
        }
        bodyType = normaliseCarBodyType(cache[url]);
        if (bodyType) {
          source = 'carwale-jsonld';
          break;
        }
      }
      if (!bodyType) {
        bodyType = agreedVariantBodyType(variants.map((variant) => variant.spec?.bodyType));
        if (bodyType) source = 'variants';
      }

      if (bodyType && source) {
        modelsByType.set(bodyType, (modelsByType.get(bodyType) ?? 0) + 1);
        bySource.set(source, (bySource.get(source) ?? 0) + 1);
      } else {
        uncovered.push(`${model.make.slug}/${model.slug}`);
      }

      const changes: string[] = [];
      for (const variant of variants) {
        const fill = carBodyTypeFill(variant.spec?.bodyType, bodyType, {
          authoritative: source === 'curated-car-body-type',
        });
        if (fill.action === 'none') continue;
        changes.push(
          fill.action === 'fill'
            ? `${variant.name}: ${fill.bodyType}`
            : `${variant.name}: ${variant.spec?.bodyType} → ${fill.bodyType} (${fill.action})`,
        );
        if (args.dryRun) continue;

        if (variant.spec) {
          await prisma.vehicleCatalogVariantSpec.update({
            where: { id: variant.spec.id },
            data: { bodyType: fill.bodyType },
          });
          if (fill.action === 'fill') counts.filled += 1;
          else if (fill.action === 'relabel') counts.relabelled += 1;
          else counts.corrected += 1;
        } else {
          await prisma.vehicleCatalogVariantSpec.create({
            data: { variantId: variant.id, bodyType: fill.bodyType, sourceName: source },
          });
          counts.created += 1;
        }
      }

      const verdict = bodyType ? `${bodyType} (${source})` : 'no body type';
      console.log(
        `${args.dryRun ? '[dry] ' : ''}${label}: ${verdict}${changes.length > 0 ? `, ${changes.length} variant(s) to write` : ''}`,
      );
      for (const change of changes) console.log(`    ${change}`);
    }

    if (args.cachePath) writeFileSync(args.cachePath, `${JSON.stringify(cache, null, 2)}\n`);

    const covered = processed - uncovered.length;
    console.log(`\nCar models with variants: ${processed}, with a body type: ${covered}.`);
    console.log(`By body type: ${JSON.stringify(Object.fromEntries(modelsByType))}`);
    console.log(`By source: ${JSON.stringify(Object.fromEntries(bySource))}`);
    console.log(`Without one (${uncovered.length}): ${uncovered.join(', ')}`);
    console.log(
      args.dryRun
        ? 'Dry run: nothing written.'
        : `Written: ${counts.filled} filled, ${counts.relabelled} relabelled, ${counts.corrected} corrected, ${counts.created} spec rows created.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
