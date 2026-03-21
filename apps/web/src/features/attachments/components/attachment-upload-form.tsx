import { FileUp, ShieldCheck } from 'lucide-react';
import { type ChangeEvent, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type AttachmentUploadFormProps = {
  error?: string | null;
  isUploading?: boolean;
  onUpload: (files: File[]) => Promise<void> | void;
};

export function AttachmentUploadForm({
  error,
  isUploading = false,
  onUpload,
}: AttachmentUploadFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!files.length) {
      return;
    }

    await onUpload(files);

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-border/70 bg-slate-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200">
                <FileUp className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-slate-950">Upload receipts or service documents</p>
                <p className="text-sm text-slate-500">
                  Add invoices, job cards, or service photos directly to this maintenance record.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">JPEG</Badge>
              <Badge tone="neutral">PNG</Badge>
              <Badge tone="neutral">WEBP</Badge>
              <Badge tone="neutral">PDF</Badge>
              <Badge tone="warning">Up to 5 MB each</Badge>
            </div>
          </div>

          <Button onClick={() => inputRef.current?.click()} type="button" variant="secondary">
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
        <input
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          ref={inputRef}
          className="sr-only"
          disabled={isUploading}
          multiple
          onChange={handleChange}
          type="file"
        />
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Unsupported file types and oversized uploads are rejected by the API.</span>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
