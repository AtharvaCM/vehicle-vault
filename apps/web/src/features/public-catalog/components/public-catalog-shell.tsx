import type { ReactNode } from 'react';

import { PublicFrame } from '@/components/public/public-frame';

type PublicCatalogShellProps = {
  children: ReactNode;
};

/**
 * The frame around every public catalog page: the shared public header and
 * footer (#340), not the signed-in app shell. It renders with no auth provider
 * at all, which is how the pages are prerendered, and shows a guest header then.
 */
export function PublicCatalogShell({ children }: PublicCatalogShellProps) {
  return (
    <PublicFrame>
      <main className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </PublicFrame>
  );
}
