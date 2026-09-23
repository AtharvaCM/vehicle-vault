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
          title: 'text-sm font-semibold',
          description: 'text-sm text-muted-foreground',
          actionButton: 'rounded-control',
          cancelButton: 'rounded-control',
        },
      }}
    />
  );
}
