import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's own theme names. Without these, it
 * reads `text-body` as a colour and drops it beside `text-fg-2`, and never
 * lets `rounded-card` replace `rounded-xl`. Keep in step with styles/tokens.css.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'page',
        'surface',
        'line',
        'line-subtle',
        'fg',
        'fg-2',
        'fg-3',
        'brand',
        'brand-hover',
        'on-brand',
        'brand-tint',
        'late',
        'on-late',
        'late-tint',
        'soon',
        'soon-dot',
        'soon-tint',
        'ok',
        'ok-tint',
        'ended',
        'ended-dot',
        'plate',
        'plate-ink',
        'plate-strip',
        'plate-ev',
        'plate-ev-ink',
        'scrim',
      ],
      text: ['caption', 'small', 'body', 'lead', 'heading', 'title', 'display'],
      font: ['display'],
      radius: ['control', 'card', 'sheet'],
      shadow: ['overlay'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
