import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from './dialog';
import { measureVisibleViewport } from './responsive-dialog';

function OpenDialog({
  className,
  onOpenChange = () => undefined,
}: {
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent className={className}>
        <DialogTitle>Add policy</DialogTitle>
        <DialogDescription>Details of the cover.</DialogDescription>
        <DialogFooter>
          <button type="submit">Save</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('DialogContent', () => {
  const originalViewport = window.visualViewport;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: originalViewport,
    });
  });

  // jsdom has no layout, so the breakpoint is asserted as the classes that
  // implement it; the Playwright spec measures the rendered sheet.
  it('is a bottom sheet below md', () => {
    render(<OpenDialog />);

    expect(screen.getByRole('dialog')).toHaveClass(
      'max-md:inset-x-0',
      'max-md:bottom-[var(--keyboard-inset,0px)]',
      'max-md:w-full',
      'max-md:rounded-b-none',
      'max-md:data-[state=open]:slide-in-from-bottom',
    );
  });

  it('keeps the centred modal from md up, exactly as it was', () => {
    render(<OpenDialog />);

    // Unprefixed: the sheet only exists inside a max-md media query.
    expect(screen.getByRole('dialog')).toHaveClass(
      'left-[50%]',
      'top-[50%]',
      'translate-x-[-50%]',
      'translate-y-[-50%]',
      'max-w-lg',
      'max-h-[85vh]',
      'rounded-2xl',
    );
  });

  it("keeps a dialog's own size overrides for md and up", () => {
    render(<OpenDialog className="max-h-[90vh] max-w-2xl" />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-2xl', 'max-h-[90vh]');
    expect(dialog).not.toHaveClass('max-w-lg');
    // …while below md the sheet still takes the full width and fits the screen.
    expect(dialog).toHaveClass(
      'max-md:max-w-none',
      'max-md:max-h-[calc(var(--visible-height,100dvh)-1.5rem)]',
    );
  });

  it('pins the footer with the primary action to the bottom of the sheet', () => {
    render(<OpenDialog />);

    const footer = screen.getByRole('button', { name: 'Save' }).parentElement;
    expect(footer).toHaveClass(
      'max-md:sticky',
      'max-md:bottom-[calc(-1.25rem-env(safe-area-inset-bottom))]',
      'max-md:bg-background',
    );
    expect(footer).toHaveClass('sm:flex-row', 'sm:justify-end');
  });

  it('sits above an open on-screen keyboard and fits the space it leaves', () => {
    const listeners = new Map<string, () => void>();
    const viewport = {
      height: 812,
      offsetTop: 0,
      addEventListener: vi.fn((type: string, listener: () => void) =>
        listeners.set(type, listener),
      ),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(812);

    render(<OpenDialog />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--keyboard-inset')).toBe('0px');

    // The keyboard opens: the visual viewport shrinks, the layout one does not.
    viewport.height = 476;
    listeners.get('resize')?.();

    expect(dialog.style.getPropertyValue('--keyboard-inset')).toBe('336px');
    expect(dialog.style.getPropertyValue('--visible-height')).toBe('476px');
  });

  it('still closes on Escape', () => {
    const onOpenChange = vi.fn();
    render(<OpenDialog onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('measureVisibleViewport', () => {
  it('reads no keyboard when the visual viewport fills the screen', () => {
    expect(measureVisibleViewport(812, { height: 812, offsetTop: 0 })).toEqual({
      keyboardInset: 0,
      visibleHeight: 812,
    });
  });

  it('reads the keyboard as the height the visual viewport lost', () => {
    expect(measureVisibleViewport(812, { height: 476, offsetTop: 0 }).keyboardInset).toBe(336);
  });

  it('allows for the page having been panned up to reveal a field', () => {
    expect(measureVisibleViewport(812, { height: 476, offsetTop: 120 }).keyboardInset).toBe(216);
  });
});
