import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResaleReportDialog } from './resale-report-dialog';

const downloadResaleReportPdf = vi.hoisted(() => vi.fn());

vi.mock('../api/download-resale-report', () => ({ downloadResaleReportPdf }));

function renderDialog(onOpenChange = vi.fn()) {
  return render(
    <ResaleReportDialog
      onOpenChange={onOpenChange}
      open
      registrationNumber="KA01AB1234"
      vehicleId="vehicle-1"
    />,
  );
}

describe('ResaleReportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadResaleReportPdf.mockResolvedValue(undefined);
  });

  it('downloads with no price when the field is left blank', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(downloadResaleReportPdf).toHaveBeenCalledWith('vehicle-1', 'KA01AB1234', undefined),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('downloads with the entered price', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Asking price (₹)'), '150000');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(downloadResaleReportPdf).toHaveBeenCalledWith('vehicle-1', 'KA01AB1234', 150000),
    );
  });

  it('rejects a non-numeric price without calling the download', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Asking price (₹)'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(screen.getByText('Enter an amount in rupees, or leave it blank.')).toBeInTheDocument();
    expect(downloadResaleReportPdf).not.toHaveBeenCalled();
  });

  it('rejects a negative price', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText('Asking price (₹)'), '-5');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(screen.getByText('Enter an amount in rupees, or leave it blank.')).toBeInTheDocument();
    expect(downloadResaleReportPdf).not.toHaveBeenCalled();
  });
});
