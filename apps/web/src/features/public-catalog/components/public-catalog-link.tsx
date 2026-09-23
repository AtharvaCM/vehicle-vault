import { Link, useRouter } from '@tanstack/react-router';
import type { PublicCatalogSegment } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';

import { publicModelPath, publicVariantPath } from '../head/public-page-head';

/** A model page's address, or a variant page's when it names a generation and variant. */
export type PublicCatalogAddress = {
  segment: PublicCatalogSegment;
  make: string;
  model: string;
} & ({ generation: string; variant: string } | { generation?: undefined; variant?: undefined });

type PublicCatalogLinkProps = {
  address: PublicCatalogAddress;
  className?: string;
  children: ReactNode;
};

/**
 * A link between public catalog pages. With a router it navigates in the app,
 * so the page's head follows along; rendered with no router at all, as a unit
 * test may, it is a plain link to the same address.
 */
export function PublicCatalogLink({ address, className, children }: PublicCatalogLinkProps) {
  const router = useRouter({ warn: false });
  const { segment, make, model, generation, variant } = address;

  if (!router) {
    const href =
      generation !== undefined
        ? publicVariantPath({
            segment,
            make: { slug: make },
            model: { slug: model },
            generation: { slug: generation },
            variant: { slug: variant },
          })
        : publicModelPath({ segment, make: { slug: make }, model: { slug: model } });
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  if (generation !== undefined) {
    const params = { make, model, generation, variant };
    return segment === 'bikes' ? (
      <Link className={className} params={params} to="/bikes/$make/$model/$generation/$variant">
        {children}
      </Link>
    ) : (
      <Link className={className} params={params} to="/cars/$make/$model/$generation/$variant">
        {children}
      </Link>
    );
  }

  return segment === 'bikes' ? (
    <Link className={className} params={{ make, model }} to="/bikes/$make/$model">
      {children}
    </Link>
  ) : (
    <Link className={className} params={{ make, model }} to="/cars/$make/$model">
      {children}
    </Link>
  );
}
