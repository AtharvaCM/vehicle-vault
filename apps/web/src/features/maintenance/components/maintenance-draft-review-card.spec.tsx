import { render, screen } from '@testing-library/react';
import { AttachmentExtractionStatus, AttachmentKind, type Attachment } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

const mutation = vi.hoisted(() => () => ({ mutateAsync: vi.fn(), isPending: false }));

const scannedJobCard: Attachment = {
  id: 'attachment-1',
  maintenanceRecordId: 'record-1',
  fileName: 'record-1/job-card.jpg',
  originalFileName: 'job-card.jpg',
  url: '/api/attachments/attachment-1/file',
  mimeType: 'image/jpeg',
  size: 4_096,
  kind: AttachmentKind.Image,
  uploadedAt: '2026-09-20T10:00:00.000Z',
  extraction: {
    id: 'extraction-1',
    attachmentId: 'attachment-1',
    status: AttachmentExtractionStatus.Completed,
    workshopName: 'Torque Garage',
    nextDueDate: '2027-03-18T00:00:00.000Z',
    nextDueOdometer: 18_200,
    createdAt: '2026-09-20T10:05:00.000Z',
    updatedAt: '2026-09-20T10:05:00.000Z',
  },
};

vi.mock('@/features/attachments/hooks/use-attachments', () => ({
  useAttachments: () => ({ data: [scannedJobCard], isPending: false, isError: false }),
}));
vi.mock('@/features/attachments/hooks/use-attachment-extraction-status', () => ({
  useAttachmentExtractionStatus: () => ({ data: { available: true } }),
}));
vi.mock('@/features/attachments/hooks/use-extract-attachment', () => ({
  useExtractAttachment: mutation,
}));
vi.mock('@/features/attachments/hooks/use-extract-attachments', () => ({
  useExtractAttachments: mutation,
}));
vi.mock('@/features/attachments/hooks/use-apply-attachment-extraction', () => ({
  useApplyAttachmentExtraction: mutation,
}));

import { MaintenanceDraftReviewCard } from './maintenance-draft-review-card';

describe('MaintenanceDraftReviewCard', () => {
  it('applies a finished extraction to a draft', () => {
    render(<MaintenanceDraftReviewCard isDraft recordId="record-1" />);

    expect(screen.getByRole('button', { name: 'Apply to draft' })).toBeInTheDocument();
  });

  it('never offers to apply one over a confirmed record, which it would overwrite', () => {
    render(<MaintenanceDraftReviewCard isDraft={false} recordId="record-1" />);

    expect(screen.queryByRole('button', { name: 'Apply to draft' })).not.toBeInTheDocument();
    // What was read stays on show.
    expect(screen.getByText('Torque Garage')).toBeInTheDocument();
  });

  it('shows when the workshop says to come back', () => {
    render(<MaintenanceDraftReviewCard isDraft recordId="record-1" />);

    expect(screen.getByText('18 Mar 2027')).toBeInTheDocument();
    expect(screen.getByText('18,200 km')).toBeInTheDocument();
  });
});
