import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentKind, type VehicleDocument } from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Attachment } from '@/features/attachments/types/attachment';

const documents = vi.hoisted(() => ({ current: [] as VehicleDocument[] }));
const files = vi.hoisted(() => ({ current: [] as Attachment[] }));
const openFile = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('../hooks/use-documents', () => ({
  useVehicleDocuments: () => ({ isPending: false, isError: false, data: documents.current }),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: () => ({
    data: {
      registrationNumber: 'MH12AB1234',
      make: 'Maruti Suzuki',
      model: 'Swift',
      variant: 'VXi',
      fuelType: 'petrol',
    },
  }),
}));
vi.mock('../hooks/use-document-attachments', () => ({
  useDocumentAttachments: () => ({ isPending: false, data: files.current }),
}));
vi.mock('../hooks/use-attachment-object-url', () => ({
  useAttachmentObjectUrl: (id: string | null) => ({
    objectUrl: id ? `blob:photo-${id}` : null,
    isPending: false,
    isError: false,
  }),
}));
vi.mock('@/lib/api/open-api-file', () => ({ openApiFileInNewTab: openFile }));

import { DocumentCheckpointPage } from './document-checkpoint-page';

const DAY = 24 * 60 * 60 * 1000;

function puc(overrides: Partial<VehicleDocument> = {}): VehicleDocument {
  return {
    id: 'puc-1',
    vehicleId: 'vehicle-1',
    kind: 'puc',
    provider: 'PUC Centre Baner',
    number: 'MH12-PUC-440192',
    startDate: new Date(Date.now() - 100 * DAY),
    endDate: new Date(Date.now() + 80 * DAY),
    notes: null,
    details: {},
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function file(mimeType: string, name: string): Attachment {
  return {
    id: `file-${name}`,
    complianceDocumentId: 'puc-1',
    kind: mimeType.startsWith('image/') ? AttachmentKind.Image : AttachmentKind.Document,
    fileName: `attachments/u/puc-1/${name}`,
    originalFileName: name,
    mimeType,
    size: 1024,
    url: `/api/attachments/file-${name}/file`,
    uploadedAt: '2026-09-01T00:00:00.000Z',
  };
}

function show() {
  return render(<DocumentCheckpointPage documentId="puc-1" kind="puc" vehicleId="vehicle-1" />);
}

describe('DocumentCheckpointPage', () => {
  beforeEach(() => {
    documents.current = [puc()];
    files.current = [];
    openFile.mockResolvedValue(undefined);
  });

  it('puts the number up large, with who issued it and how long it runs', () => {
    show();

    expect(screen.getByRole('heading', { name: 'PUC certificate' })).toBeInTheDocument();
    expect(screen.getByText('MH 12 AB 1234')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="number-plate"]')).toHaveAttribute('data-size', 'xl');
    expect(screen.getByText('Maruti Suzuki Swift VXi · Petrol')).toBeInTheDocument();
    const number = screen.getByText('MH12-PUC-440192');
    expect(number).toHaveClass('text-4xl');
    expect(screen.getByText('PUC Centre Baner')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('VALID');
  });

  it('shows an attached photo in place', () => {
    files.current = [file('image/jpeg', 'puc.jpg')];

    show();

    expect(screen.getByRole('img', { name: 'puc.jpg' })).toHaveAttribute(
      'src',
      'blob:photo-file-puc.jpg',
    );
  });

  it('opens an attached PDF on its own', async () => {
    const user = userEvent.setup();
    files.current = [file('application/pdf', 'puc.pdf')];
    show();

    await user.click(screen.getByRole('button', { name: 'Open puc.pdf' }));

    expect(openFile).toHaveBeenCalledWith('/attachments/file-puc.pdf/file');
  });

  it('says there is no file rather than showing an empty space', () => {
    show();

    expect(screen.getByText(/No file attached/)).toBeInTheDocument();
  });

  it('says plainly when the document has expired', () => {
    documents.current = [puc({ endDate: new Date(Date.now() - 3 * DAY) })];

    show();

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('EXPIRED');
    expect(status).toHaveTextContent(/Ran out on/);
    expect(status).not.toHaveTextContent('VALID');
  });

  it('warns when it runs out soon', () => {
    documents.current = [puc({ endDate: new Date(Date.now() + 5 * DAY) })];

    show();

    expect(screen.getByRole('status')).toHaveTextContent(/Runs out in \d days/);
  });

  it('does not show a document that is not on this vehicle', () => {
    documents.current = [];

    show();

    expect(screen.getByText(/isn.t on this vehicle/)).toBeInTheDocument();
  });
});
