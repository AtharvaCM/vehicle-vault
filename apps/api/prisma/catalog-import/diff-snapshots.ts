import { execSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import type { CatalogImportSource } from './types';

type Brand = CatalogImportSource['dataset'][number];
type Model = Brand['models'][number];
type Generation = Model['generations'][number];
type Variant = Generation['variants'][number];

interface BrandChange {
  brand: string;
  vehicleType: string;
  addedModels: string[];
  removedModels: string[];
  modelChanges: ModelChange[];
}

interface ModelChange {
  model: string;
  addedGenerations: string[];
  removedGenerations: string[];
  becameDiscontinued: string[];
  becameCurrent: string[];
  addedVariants: { generation: string; variant: string }[];
  removedVariants: { generation: string; variant: string }[];
}

const SOURCES_DIR = resolve(__dirname, 'sources');
const REPO_REL = 'apps/api/prisma/catalog-import/sources';

function loadSource(path: string): CatalogImportSource | null {
  delete require.cache[require.resolve(path)];
  const mod = require(path);
  const exported = Object.values(mod).find(
    (v): v is CatalogImportSource =>
      typeof v === 'object' && v !== null && 'dataset' in (v as object),
  );
  return exported ?? null;
}

function loadHeadVersion(fileName: string, tmpDir: string): CatalogImportSource | null {
  try {
    const content = execSync(`git show HEAD:${REPO_REL}/${fileName}`, { encoding: 'utf-8' });
    const tmpPath = join(tmpDir, fileName);
    // rewrite the relative type import to absolute so require() resolves it
    const patched = content.replace(
      /from\s+['"]\.\.\/types['"]/,
      `from '${resolve(__dirname, 'types')}'`,
    );
    writeFileSync(tmpPath, patched, 'utf-8');
    return loadSource(tmpPath);
  } catch {
    return null;
  }
}

function indexBrands(source: CatalogImportSource): Map<string, Brand> {
  const map = new Map<string, Brand>();
  for (const brand of source.dataset) {
    map.set(`${brand.name}::${brand.vehicleType}`, brand);
  }
  return map;
}

function indexBy<T>(items: T[], key: (t: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(key(item), item);
  return map;
}

function diffModel(prev: Model, next: Model): ModelChange | null {
  const change: ModelChange = {
    model: next.name,
    addedGenerations: [],
    removedGenerations: [],
    becameDiscontinued: [],
    becameCurrent: [],
    addedVariants: [],
    removedVariants: [],
  };

  const prevGens = indexBy(prev.generations, (g) => g.name);
  const nextGens = indexBy(next.generations, (g) => g.name);

  for (const [name, gen] of nextGens) {
    if (!prevGens.has(name)) change.addedGenerations.push(name);
  }
  for (const [name] of prevGens) {
    if (!nextGens.has(name)) change.removedGenerations.push(name);
  }

  for (const [name, nextGen] of nextGens) {
    const prevGen = prevGens.get(name);
    if (!prevGen) continue;
    if (prevGen.isCurrent && !nextGen.isCurrent) change.becameDiscontinued.push(name);
    if (!prevGen.isCurrent && nextGen.isCurrent) change.becameCurrent.push(name);

    const prevVars = indexBy(prevGen.variants, (v: Variant) => v.name);
    const nextVars = indexBy(nextGen.variants, (v: Variant) => v.name);
    for (const [vName] of nextVars) {
      if (!prevVars.has(vName)) change.addedVariants.push({ generation: name, variant: vName });
    }
    for (const [vName] of prevVars) {
      if (!nextVars.has(vName)) change.removedVariants.push({ generation: name, variant: vName });
    }
  }

  const hasChange =
    change.addedGenerations.length > 0 ||
    change.removedGenerations.length > 0 ||
    change.becameDiscontinued.length > 0 ||
    change.becameCurrent.length > 0 ||
    change.addedVariants.length > 0 ||
    change.removedVariants.length > 0;

  return hasChange ? change : null;
}

function diffSource(prev: CatalogImportSource, next: CatalogImportSource): BrandChange[] {
  const prevBrands = indexBrands(prev);
  const nextBrands = indexBrands(next);
  const changes: BrandChange[] = [];

  const allKeys = new Set([...prevBrands.keys(), ...nextBrands.keys()]);
  for (const key of allKeys) {
    const prevBrand = prevBrands.get(key);
    const nextBrand = nextBrands.get(key);
    const name = (nextBrand ?? prevBrand)!.name;
    const vehicleType = (nextBrand ?? prevBrand)!.vehicleType as string;

    const brandChange: BrandChange = {
      brand: name,
      vehicleType,
      addedModels: [],
      removedModels: [],
      modelChanges: [],
    };

    if (!prevBrand) {
      brandChange.addedModels = nextBrand!.models.map((m) => m.name);
    } else if (!nextBrand) {
      brandChange.removedModels = prevBrand.models.map((m) => m.name);
    } else {
      const prevModels = indexBy(prevBrand.models, (m) => m.name);
      const nextModels = indexBy(nextBrand.models, (m) => m.name);
      for (const [mName, model] of nextModels) {
        if (!prevModels.has(mName)) brandChange.addedModels.push(mName);
        else {
          const mc = diffModel(prevModels.get(mName)!, model);
          if (mc) brandChange.modelChanges.push(mc);
        }
      }
      for (const [mName] of prevModels) {
        if (!nextModels.has(mName)) brandChange.removedModels.push(mName);
      }
    }

    if (
      brandChange.addedModels.length > 0 ||
      brandChange.removedModels.length > 0 ||
      brandChange.modelChanges.length > 0
    ) {
      changes.push(brandChange);
    }
  }

  return changes;
}

function printChange(source: string, changes: BrandChange[]): void {
  if (changes.length === 0) return;
  console.log(`\n📦 ${source}`);
  console.log('─'.repeat(60));
  for (const bc of changes) {
    console.log(`  ${bc.brand} (${bc.vehicleType})`);
    if (bc.addedModels.length > 0)
      console.log(`    + models:      ${bc.addedModels.join(', ')}`);
    if (bc.removedModels.length > 0)
      console.log(`    - models:      ${bc.removedModels.join(', ')}`);
    for (const mc of bc.modelChanges) {
      const parts: string[] = [];
      if (mc.addedGenerations.length > 0) parts.push(`+gen ${mc.addedGenerations.join('|')}`);
      if (mc.removedGenerations.length > 0) parts.push(`-gen ${mc.removedGenerations.join('|')}`);
      if (mc.becameDiscontinued.length > 0)
        parts.push(`discontinued ${mc.becameDiscontinued.join('|')}`);
      if (mc.becameCurrent.length > 0) parts.push(`re-current ${mc.becameCurrent.join('|')}`);
      if (mc.addedVariants.length > 0)
        parts.push(`+var ${mc.addedVariants.map((v) => v.variant).join('|')}`);
      if (mc.removedVariants.length > 0)
        parts.push(`-var ${mc.removedVariants.map((v) => v.variant).join('|')}`);
      console.log(`    ~ ${mc.model}: ${parts.join(' • ')}`);
    }
  }
}

function main(): void {
  const tmpDir = mkdtempSync(join(tmpdir(), 'catalog-diff-'));
  const files = readdirSync(SOURCES_DIR).filter((f) => f.endsWith('.snapshot.ts'));

  let totals = {
    addedModels: 0,
    removedModels: 0,
    addedVariants: 0,
    removedVariants: 0,
    discontinued: 0,
    brandsChanged: 0,
  };

  for (const file of files) {
    const nextPath = join(SOURCES_DIR, file);
    const next = loadSource(nextPath);
    if (!next) {
      console.log(`⚠️  could not load ${file}`);
      continue;
    }
    const prev = loadHeadVersion(file, tmpDir);
    if (!prev) {
      console.log(`\n🆕 ${file} (new file — no HEAD version)`);
      continue;
    }
    const changes = diffSource(prev, next);
    printChange(file, changes);
    for (const bc of changes) {
      totals.brandsChanged++;
      totals.addedModels += bc.addedModels.length;
      totals.removedModels += bc.removedModels.length;
      for (const mc of bc.modelChanges) {
        totals.addedVariants += mc.addedVariants.length;
        totals.removedVariants += mc.removedVariants.length;
        totals.discontinued += mc.becameDiscontinued.length;
      }
    }
  }

  console.log('\n═══ summary ═══');
  console.log(`  brands changed:   ${totals.brandsChanged}`);
  console.log(`  + models:         ${totals.addedModels}`);
  console.log(`  - models:         ${totals.removedModels}`);
  console.log(`  + variants:       ${totals.addedVariants}`);
  console.log(`  - variants:       ${totals.removedVariants}`);
  console.log(`  newly discontinued: ${totals.discontinued}`);
}

main();
