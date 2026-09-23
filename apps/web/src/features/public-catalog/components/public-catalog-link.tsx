import { Link, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { publicCatalogPath, type PublicCatalogAddress } from '../head/public-page-head';

export type { PublicCatalogAddress } from '../head/public-page-head';

/**
 * Active only on its own page. The router's default also marks a link active
 * (with `aria-current="page"`) on every page below it, which would call each
 * breadcrumb above the page the current one.
 */
const EXACT = { exact: true } as const;

type PublicCatalogLinkProps = {
  /** A browse, make, model or variant page, by what the address names. */
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

  if (!router) {
    return (
      <a className={className} href={publicCatalogPath(address)}>
        {children}
      </a>
    );
  }

  const bikes = address.segment === 'bikes';

  if (address.generation !== undefined) {
    const { make, model, generation, variant } = address;
    const params = { make, model, generation, variant };
    return bikes ? (
      <Link
        activeOptions={EXACT}
        className={className}
        params={params}
        to="/bikes/$make/$model/$generation/$variant"
      >
        {children}
      </Link>
    ) : (
      <Link
        activeOptions={EXACT}
        className={className}
        params={params}
        to="/cars/$make/$model/$generation/$variant"
      >
        {children}
      </Link>
    );
  }

  if (address.model !== undefined) {
    const params = { make: address.make, model: address.model };
    return bikes ? (
      <Link activeOptions={EXACT} className={className} params={params} to="/bikes/$make/$model">
        {children}
      </Link>
    ) : (
      <Link activeOptions={EXACT} className={className} params={params} to="/cars/$make/$model">
        {children}
      </Link>
    );
  }

  if (address.make !== undefined) {
    const params = { make: address.make };
    return bikes ? (
      <Link activeOptions={EXACT} className={className} params={params} to="/bikes/$make">
        {children}
      </Link>
    ) : (
      <Link activeOptions={EXACT} className={className} params={params} to="/cars/$make">
        {children}
      </Link>
    );
  }

  return bikes ? (
    <Link activeOptions={EXACT} className={className} to="/bikes">
      {children}
    </Link>
  ) : (
    <Link activeOptions={EXACT} className={className} to="/cars">
      {children}
    </Link>
  );
}
