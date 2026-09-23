import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Attachment, AttachmentExtraction } from '@/features/attachments/types/attachment';

import { DraftBillSummary } from './draft-bill-summary';

const pdf = (extraction?: Partial<AttachmentExtraction>) =>
  ({
    id: 'attachment-1',
    originalFileName: 'job-card.pdf',
    mimeType: 'application/pdf',
    extraction: extraction
      ? { id: 'e', attachmentId: 'attachment-1', updatedAt: '', createdAt: '', ...extraction }
      : undefined,
  }) as Attachment;

function show(
  props: Partial<Parameters<typeof DraftBillSummary>[0]> & { attachments: Attachment[] },
) {
  const client = new QueryClient();

  render(
    <QueryClientProvider client={client}>
      <DraftBillSummary fieldsFromBillCount={0} {...props} />
    </QueryClientProvider>,
  );
}

describe('DraftBillSummary', () => {
  it('says the draft was filled from the bill', () => {
    const attachment = pdf({
      status: 'completed',
      odometer: 32_150,
    } as Partial<AttachmentExtraction>);
    show({ attachments: [attachment], extraction: attachment.extraction, fieldsFromBillCount: 3 });

    expect(screen.getByText(/Filled in from the bill/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open job-card.pdf' })).toBeInTheDocument();
  });

  it('says why the form is blank when the read found nothing', () => {
    const attachment = pdf({ status: 'completed' } as Partial<AttachmentExtraction>);
    show({ attachments: [attachment], extraction: attachment.extraction });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Nothing on the bill could be read into the form.',
    );
  });

  it('says the read failed, with the reason', () => {
    show({
      attachments: [
        pdf({
          status: 'failed',
          failureReason: 'Unreadable image',
        } as Partial<AttachmentExtraction>),
      ],
    });

    expect(screen.getByRole('status')).toHaveTextContent(
      'The bill could not be read (Unreadable image).',
    );
  });

  it('says reading is unavailable when the server cannot read bills', () => {
    show({ attachments: [pdf()], extractionAvailable: false });

    expect(screen.getByRole('status')).toHaveTextContent("Reading bills isn't available right now");
  });

  it('shows nothing for a draft with no files', () => {
    show({ attachments: [] });

    expect(screen.queryByTestId('draft-bill-summary')).not.toBeInTheDocument();
  });
});
