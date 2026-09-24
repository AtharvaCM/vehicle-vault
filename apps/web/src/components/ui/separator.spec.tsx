import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Separator } from './separator';

describe('Separator', () => {
  it('renders as a decorative, non-focusable divider by default', () => {
    const { container } = render(<Separator />);

    const separator = container.querySelector('[data-slot="separator"]');
    expect(separator).toHaveAttribute('role', 'none');
  });

  it('is announced as a separator when not decorative', () => {
    const { getByRole } = render(<Separator decorative={false} />);

    expect(getByRole('separator')).toBeInTheDocument();
  });
});
