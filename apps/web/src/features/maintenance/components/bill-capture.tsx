import { Camera, Loader2 } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';

import { Button } from '@/components/ui/button';

type BillCaptureProps = {
  isPending: boolean;
  /** Whether the bill will be read; the upload works either way. */
  canRead: boolean;
  onFiles: (event: ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Bill first: "Snap the bill" opens the camera, "Choose file" takes a photo
 * already on the phone (a WhatsApp forward) or a PDF invoice. Either starts
 * the upload-first flow, which lands on a draft filled in from the bill.
 */
export function BillCapture({ isPending, canRead, onFiles }: BillCaptureProps) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <Button
          className="h-14 border-[1.5px] border-dashed border-brand bg-brand-tint text-brand hover:bg-brand-tint md:h-12"
          disabled={isPending}
          onClick={() => cameraRef.current?.click()}
          type="button"
          variant="outline"
        >
          {isPending ? (
            <Loader2 aria-hidden="true" className="animate-spin" />
          ) : (
            <Camera aria-hidden="true" />
          )}
          {isPending ? 'Reading the bill…' : 'Snap the bill'}
        </Button>
        <Button
          className="h-14 md:h-12"
          disabled={isPending}
          onClick={() => fileRef.current?.click()}
          type="button"
          variant="outline"
        >
          Choose file
        </Button>
      </div>
      <p className="text-center text-small text-fg-3">
        {canRead
          ? "We'll fill the form from the bill. You check it and save."
          : "We'll keep the bill with a draft for you to fill in and save."}
      </p>
      {/* The camera, and (below) the picker for a photo on the phone or a PDF. */}
      <input
        accept="image/*"
        aria-hidden="true"
        capture="environment"
        className="sr-only"
        data-testid="bill-camera-input"
        onChange={onFiles}
        ref={cameraRef}
        tabIndex={-1}
        type="file"
      />
      <input
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
        aria-hidden="true"
        className="sr-only"
        data-testid="bill-file-input"
        multiple
        onChange={onFiles}
        ref={fileRef}
        tabIndex={-1}
        type="file"
      />
    </div>
  );
}
