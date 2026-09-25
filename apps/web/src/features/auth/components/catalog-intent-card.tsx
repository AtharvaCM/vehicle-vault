import { Car } from 'lucide-react';

import {
  isCatalogVariantIntent,
  type CatalogIntent,
  type CatalogModelIntent,
  type CatalogVariantIntent,
} from '@/features/catalog-intent/lib/catalog-intent';
import { usePublicModelPage } from '@/features/public-catalog/api/use-public-model-page';
import { usePublicVariantPage } from '@/features/public-catalog/api/use-public-variant-page';

/** "maruti-suzuki" → "Maruti Suzuki": a name to show until the catalog answers. */
function fromSlug(slug: string) {
  return slug
    .split('-')
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1)))
    .join(' ');
}

function Card({ name }: { name: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-card border border-brand/30 bg-brand-tint/60 p-3"
      data-testid="catalog-intent-card"
    >
      <Car aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
      <div className="min-w-0">
        <p className="text-small font-semibold text-brand">Tracking</p>
        <p className="font-semibold text-fg">{name}</p>
        <p className="text-small text-fg-2">Track its service schedule, insurance and PUC.</p>
      </div>
    </div>
  );
}

function VariantCard({ intent }: { intent: CatalogVariantIntent }) {
  const page = usePublicVariantPage(intent).data;
  const name = page
    ? `${page.make.name} ${page.model.name} · ${page.variant.name}`
    : `${fromSlug(intent.make)} ${fromSlug(intent.model)} · ${fromSlug(intent.variant)}`;
  return <Card name={name} />;
}

function ModelCard({ intent }: { intent: CatalogModelIntent }) {
  const page = usePublicModelPage(intent).data;
  const name = page
    ? `${page.make.name} ${page.model.name}`
    : `${fromSlug(intent.make)} ${fromSlug(intent.model)}`;
  return <Card name={name} />;
}

/**
 * On register, the vehicle a visitor asked to track from a catalog page: the
 * reason they are signing up, kept in view (#343).
 */
export function CatalogIntentCard({ intent }: { intent: CatalogIntent }) {
  return isCatalogVariantIntent(intent) ? (
    <VariantCard intent={intent} />
  ) : (
    <ModelCard intent={intent as CatalogModelIntent} />
  );
}
