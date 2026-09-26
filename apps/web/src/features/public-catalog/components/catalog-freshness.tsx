import { format } from '@/lib/format';

/**
 * The last line of a catalog page: when its figures last changed, from the
 * payload's `updatedAt` (the newest change to anything on the page).
 */
export function CatalogFreshness({ updatedAt }: { updatedAt: string }) {
  return (
    <p
      className="border-t border-line-subtle pt-4 text-small text-fg-3"
      data-testid="catalog-freshness"
    >
      Details last updated {format.date(updatedAt)}. Your owner’s manual has the final word.
    </p>
  );
}
