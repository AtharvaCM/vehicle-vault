import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentKind, VehicleRole } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';

const upload = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const openFile = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-document-attachments', () => ({
  useDocumentAttachments: () => ({
    isPending: false,
    isError: false,
    data: [
      {
        id: 'attachment-1',
        insurancePolicyId: 'pol-1',
        kind: AttachmentKind.Document,
        fileName: 'attachments/user-1/pol-1/a.pdf',
        originalFileName: 'policy-2026.pdf',
        mimeType: 'application/pdf',
        size: 204_800,
        url: '/api/attachments/attachment-1/file',
        uploadedAt: '2026-09-22T10:00:00.000Z',
      },
    ],
  }),
  useUploadDocumentAttachments: () => ({ mutateAsync: upload, isPending: false }),
  useDeleteDocumentAttachment: () => ({ mutateAsync: remove, isPending: false }),
}));
vi.mock('@/lib/api/open-api-file', () => ({ openApiFileInNewTab: openFile }));

import { DocumentAttachmentsSection } from './document-attachments-section';

function renderAs(role: VehicleRole) {
  return render(
    <VehicleAccessProvider role={role}>
      <DocumentAttachmentsSection documentId="pol-1" kind="insurance" />
    </VehicleAccessProvider>,
  );
}

describe('DocumentAttachmentsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    upload.mockResolvedValue([]);
    remove.mockResolvedValue({ id: 'attachment-1', deleted: true });
    openFile.mockResolvedValue(undefined);
  });

  it("lists the policy's files and opens one", async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Owner);

    await user.click(screen.getByRole('button', { name: /^policy-2026\.pdf/ }));

    expect(openFile).toHaveBeenCalledWith('/attachments/attachment-1/file');
  });

  it('uploads the chosen files to the policy', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Editor);
    const file = new File(['%PDF'], 'renewal.pdf', { type: 'application/pdf' });

    await user.upload(screen.getByLabelText('Add files to this document'), file);

    await waitFor(() => expect(upload).toHaveBeenCalledWith([file]));
  });

  it('removes a file for an editor', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Editor);

    await user.click(screen.getByRole('button', { name: 'Remove policy-2026.pdf' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('attachment-1'));
  });

  it('lets a viewer open files but not add or remove them', async () => {
    const user = userEvent.setup();
    renderAs(VehicleRole.Viewer);

    const section = screen.getByRole('region', { name: 'Document files' });
    expect(within(section).queryByRole('button', { name: 'Add file' })).not.toBeInTheDocument();
    expect(within(section).queryByLabelText('Add files to this document')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: /^policy-2026\.pdf/ }));
    expect(openFile).toHaveBeenCalled();
  });
});
