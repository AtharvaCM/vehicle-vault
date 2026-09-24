import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/shared/form-field';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { appToast } from '@/lib/toast';

import { downloadResaleReportPdf } from '../api/download-resale-report';

type ResaleReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  registrationNumber: string;
};

/**
 * Replaces the old `window.prompt` for the resale report's optional asking
 * price: blank means no price, otherwise it must be a finite, non-negative
 * number.
 */
export function ResaleReportDialog({
  open,
  onOpenChange,
  vehicleId,
  registrationNumber,
}: ResaleReportDialogProps) {
  const [askingPrice, setAskingPrice] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [isDownloading, setIsDownloading] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setAskingPrice('');
      setError(undefined);
    }
    onOpenChange(next);
  }

  async function handleDownload() {
    const trimmed = askingPrice.trim();
    let price: number | undefined;

    if (trimmed !== '') {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('Enter an amount in rupees, or leave it blank.');
        return;
      }
      price = parsed;
    }

    setError(undefined);
    setIsDownloading(true);
    try {
      await downloadResaleReportPdf(vehicleId, registrationNumber, price);
      appToast.success({
        title: 'Resale report downloaded',
        description: 'Buyer-facing PDF saved.',
      });
      handleOpenChange(false);
    } catch (downloadError) {
      appToast.error({
        title: 'Could not generate report',
        description: getApiErrorMessage(downloadError),
      });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download resale report</DialogTitle>
          <DialogDescription>
            Add an asking price to show buyers, or leave it blank.
          </DialogDescription>
        </DialogHeader>
        <FormField error={error} htmlFor="resale-asking-price" label="Asking price (₹)">
          <Input
            disabled={isDownloading}
            id="resale-asking-price"
            inputMode="numeric"
            onChange={(event) => {
              setAskingPrice(event.target.value);
              if (error) setError(undefined);
            }}
            value={askingPrice}
          />
        </FormField>
        <DialogFooter>
          <Button
            disabled={isDownloading}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isDownloading} onClick={handleDownload} type="button">
            {isDownloading ? 'Downloading…' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
