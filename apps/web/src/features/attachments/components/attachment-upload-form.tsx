import { type ChangeEvent, useRef } from 'react';

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
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => inputRef.current?.click()} type="button" variant="secondary">
          {isUploading ? 'Uploading...' : 'Upload Files'}
        </Button>
        <input
          ref={inputRef}
          className="sr-only"
          disabled={isUploading}
          multiple
          onChange={handleChange}
          type="file"
        />
        <p className="text-sm text-slate-500">JPEG, PNG, WEBP, or PDF up to 5 MB per file.</p>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
