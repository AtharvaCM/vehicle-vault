import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useCatalogImportRuns = vi.hoisted(() => vi.fn());
const idleMutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));
const detailQuery = vi.hoisted(() => ({ current: { data: undefined } as Record<string, unknown> }));
const publish = vi.hoisted(() => vi.fn());
const archiveMissing = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-catalog-import-runs', () => ({ useCatalogImportRuns }));
vi.mock('../hooks/use-catalog-import-run-detail', () => ({
  useCatalogImportRunDetail: (runId: string | null) =>
    runId ? detailQuery.current : { data: undefined, isPending: false, isError: false },
}));
vi.mock('../hooks/use-archive-missing-catalog-import-run', () => ({
  useArchiveMissingCatalogImportRun: () => ({ mutateAsync: archiveMissing, isPending: false }),
}));
vi.mock('../hooks/use-publish-catalog-import-run', () => ({
  usePublishCatalogImportRun: () => ({ mutateAsync: publish, isPending: false }),
}));
vi.mock('../hooks/use-update-vehicle-catalog-offering-review', () => ({
  useUpdateVehicleCatalogOfferingReview: idleMutation,
}));

import { CatalogImportReviewPanel } from './catalog-review-panel';

describe('CatalogImportReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCatalogImportRuns.mockReturnValue({ data: [], isPending: false, isError: false });
  });

  it('asks for the import runs and shows the review card', () => {
    render(<CatalogImportReviewPanel />);

    expect(screen.getByText('Catalog review')).toBeInTheDocument();
    expect(useCatalogImportRuns).toHaveBeenCalled();
  });
});

describe('CatalogImportReviewPanel publishing', () => {
  const diff = {
    incomingCounts: { makes: 1, models: 3, generations: 3, variants: 12, offerings: 12 },
    publishedCounts: { makes: 1, models: 2, generations: 2, variants: 9, offerings: 9 },
    newModels: ['Honda / Elevate'],
    newVariants: ['Honda / Elevate / I / V', 'Honda / Elevate / I / VX', 'Honda / City / 5 / SV'],
    changedVariants: ['Honda / Amaze / 3 / S'],
    changedVariantDetails: [
      {
        variant: 'Honda / Amaze / 3 / S',
        changes: [{ field: 'Years', before: '2019 to 2022', after: '2018 to 2022' }],
      },
    ],
    missingVariants: ['Honda / Jazz / 3 / V'],
  };
  const run = {
    id: 'run-1',
    sourceKey: 'honda-official',
    marketCode: 'IN',
    status: 'succeeded',
    startedAt: '2026-09-20T00:00:00.000Z',
    snapshotCount: 1,
    recordsUpserted: 0,
    diff,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useCatalogImportRuns.mockReturnValue({ data: [run], isPending: false, isError: false });
    detailQuery.current = {
      data: { ...run, dataset: [], publishedOfferings: [] },
      isPending: false,
      isError: false,
    };
    publish.mockResolvedValue(run);
    archiveMissing.mockResolvedValue({ ...run, diff: { ...diff, missingVariants: [] } });
  });

  it('offers no publish on the run list, only the review', () => {
    render(<CatalogImportReviewPanel />);

    expect(screen.getByRole('button', { name: /review diff/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /publish/i })).not.toBeInTheDocument();
  });

  it('shows what changed in each changed variant', async () => {
    render(<CatalogImportReviewPanel />);
    await userEvent.click(screen.getByRole('button', { name: /review diff/i }));

    expect(screen.getByText('Honda / Amaze / 3 / S')).toBeInTheDocument();
    expect(screen.getByText('2019 to 2022 → 2018 to 2022')).toBeInTheDocument();
  });

  it('publishes only after a confirmation that restates the impact', async () => {
    render(<CatalogImportReviewPanel />);
    await userEvent.click(screen.getByRole('button', { name: /review diff/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve and publish' }));

    const confirm = screen.getByRole('alertdialog');
    expect(confirm).toHaveTextContent(
      'Publish Honda Official: +1 model, +3 variants, 1 changed, 1 missing left as-is.',
    );
    expect(confirm).toHaveTextContent('public catalog pages, the vehicle pickers');
    expect(publish).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Publish' }));

    expect(publish).toHaveBeenCalledWith('run-1');
  });

  it('archives missing variants only after its own confirmation', async () => {
    render(<CatalogImportReviewPanel />);
    await userEvent.click(screen.getByRole('button', { name: /review diff/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Archive missing as historical' }));

    const confirm = screen.getByRole('alertdialog');
    expect(confirm).toHaveTextContent('Archive 1 missing variant as historical?');
    expect(confirm).toHaveTextContent('This does not publish the import.');
    expect(archiveMissing).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole('button', { name: 'Archive 1 variant' }));

    expect(archiveMissing).toHaveBeenCalledWith('run-1');
    expect(publish).not.toHaveBeenCalled();
  });
});
