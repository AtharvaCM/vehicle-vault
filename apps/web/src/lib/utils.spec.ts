import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('keeps a type-scale size beside a colour', () => {
    expect(cn('text-body', 'text-fg-2')).toBe('text-body text-fg-2');
    expect(cn('text-small text-slate-500')).toBe('text-small text-slate-500');
  });

  it('lets a later token replace an earlier value of the same kind', () => {
    expect(cn('text-body', 'text-sm')).toBe('text-sm');
    expect(cn('rounded-xl', 'rounded-card')).toBe('rounded-card');
    expect(cn('shadow-lg', 'shadow-overlay')).toBe('shadow-overlay');
    expect(cn('bg-white', 'bg-surface')).toBe('bg-surface');
    expect(cn('text-slate-600', 'text-late')).toBe('text-late');
    expect(cn('font-sans', 'font-display')).toBe('font-display');
  });
});
