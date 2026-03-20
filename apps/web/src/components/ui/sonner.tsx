import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: 'rounded-2xl border border-border shadow-lg',
          title: 'text-sm font-semibold',
          description: 'text-sm text-muted-foreground',
          actionButton: 'rounded-xl',
          cancelButton: 'rounded-xl',
        },
      }}
    />
  );
}
