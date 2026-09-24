import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-card border border-border shadow-overlay',
          title: 'text-body font-semibold',
          description: 'text-small text-fg-2',
          actionButton: 'rounded-control',
          cancelButton: 'rounded-control',
        },
      }}
    />
  );
}
