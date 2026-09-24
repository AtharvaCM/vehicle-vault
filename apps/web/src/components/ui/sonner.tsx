import type { CSSProperties } from 'react';
import { Toaster as Sonner } from 'sonner';

import { useResolvedTheme } from '@/lib/theme';

/**
 * Sonner's colours, taken from the tokens so toasts follow the theme like the
 * rest of the app instead of Sonner's own light and dark palettes: a plain
 * toast is a card, and each kind is its status on its tint.
 */
const TOKEN_COLORS = {
  '--normal-bg': 'var(--surface-card)',
  '--normal-border': 'var(--line)',
  '--normal-text': 'var(--fg)',
  '--success-bg': 'var(--ok-tint)',
  '--success-border': 'var(--ok-tint)',
  '--success-text': 'var(--ok)',
  '--error-bg': 'var(--late-tint)',
  '--error-border': 'var(--late-tint)',
  '--error-text': 'var(--late)',
  '--warning-bg': 'var(--soon-tint)',
  '--warning-border': 'var(--soon-tint)',
  '--warning-text': 'var(--soon)',
  '--info-bg': 'var(--brand-tint)',
  '--info-border': 'var(--brand-tint)',
  '--info-text': 'var(--brand)',
} as CSSProperties;

export function Toaster() {
  // Still passed, for the parts Sonner draws from its own theme (the close button).
  const theme = useResolvedTheme();

  return (
    <Sonner
      closeButton
      theme={theme}
      position="top-right"
      richColors
      style={TOKEN_COLORS}
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
