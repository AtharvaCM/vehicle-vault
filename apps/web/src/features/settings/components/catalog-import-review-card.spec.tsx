import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ current: { user: {} as Record<string, unknown> | null } }));
const useCatalogImportRuns = vi.hoisted(() => vi.fn());
const idleMutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('../hooks/use-catalog-import-runs', () => ({ useCatalogImportRuns }));
vi.mock('../hooks/use-catalog-import-run-detail', () => ({
  useCatalogImportRunDetail: () => ({ data: undefined, isPending: false, isError: false }),
}));
vi.mock('../hooks/use-archive-missing-catalog-import-run', () => ({
  useArchiveMissingCatalogImportRun: idleMutation,
}));
vi.mock('../hooks/use-publish-catalog-import-run', () => ({
  usePublishCatalogImportRun: idleMutation,
}));
vi.mock('../hooks/use-update-vehicle-catalog-offering-review', () => ({
  useUpdateVehicleCatalogOfferingReview: idleMutation,
}));

import { CatalogImportReviewCard, canSeeCatalogReview } from './catalog-import-review-card';

describe('CatalogImportReviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCatalogImportRuns.mockReturnValue({ data: [], isPending: false, isError: false });
  });

  it('shows a regular user nothing, and never asks for import runs', () => {
    auth.current = { user: { role: 'user', allowedCatalogSources: [] } };
    const { container } = render(<CatalogImportReviewCard />);

    expect(container).toBeEmptyDOMElement();
    expect(useCatalogImportRuns).not.toHaveBeenCalled();
  });

  it('shows a user with a source grant the card as before', () => {
    auth.current = { user: { role: 'user', allowedCatalogSources: ['tata-india'] } };
    render(<CatalogImportReviewCard />);

    expect(screen.getByText('Catalog review')).toBeInTheDocument();
    expect(useCatalogImportRuns).toHaveBeenCalled();
  });

  it('shows an admin the card even without a grant', () => {
    auth.current = { user: { role: 'admin', allowedCatalogSources: [] } };
    render(<CatalogImportReviewCard />);

    expect(screen.getByText('Catalog review')).toBeInTheDocument();
  });

  it('treats a signed-out or unloaded user as not permitted', () => {
    expect(canSeeCatalogReview(null)).toBe(false);
    expect(canSeeCatalogReview({})).toBe(false);
  });
});
