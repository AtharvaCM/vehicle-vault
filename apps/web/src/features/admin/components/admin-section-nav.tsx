import { Link } from '@tanstack/react-router';

import { useAuth } from '@/features/auth/hooks/use-auth';

import { canSeeCatalogReview, canSeeUsers } from '../lib/admin-access';

const TAB_CLASS =
  'flex h-11 items-center border-b-2 border-transparent px-1 text-ui font-medium text-fg-2 transition-colors hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[status=active]:border-brand data-[status=active]:font-semibold data-[status=active]:text-fg md:h-10';

/**
 * The admin area's sections, as a row of tabs above each section's page. A
 * curator who may only review catalog sources sees that one tab.
 */
export function AdminSectionNav() {
  const { user } = useAuth();
  const sections = [
    canSeeUsers(user) ? ({ to: '/admin/users', label: 'Users' } as const) : null,
    canSeeUsers(user) ? ({ to: '/admin/messages', label: 'Messages' } as const) : null,
    canSeeCatalogReview(user)
      ? ({ to: '/admin/catalog', label: 'Catalog curation' } as const)
      : null,
  ].filter((section) => section !== null);

  return (
    <nav aria-label="Admin sections" className="border-b border-line">
      <ul className="flex gap-6">
        {sections.map((section) => (
          <li key={section.to}>
            <Link className={TAB_CLASS} to={section.to}>
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
