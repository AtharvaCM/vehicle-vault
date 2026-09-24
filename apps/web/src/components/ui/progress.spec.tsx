import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Progress } from './progress';

describe('Progress', () => {
  it('sets aria-valuenow from the value prop', () => {
    render(<Progress aria-label="Papers health" value={62} />);

    expect(screen.getByRole('progressbar', { name: 'Papers health' })).toHaveAttribute(
      'aria-valuenow',
      '62',
    );
  });

  it('accepts an indicatorClassName to recolour the bar', () => {
    const { container } = render(<Progress indicatorClassName="bg-late" value={90} />);

    expect(container.querySelector('[data-slot="progress-indicator"]')).toHaveClass('bg-late');
  });
});
