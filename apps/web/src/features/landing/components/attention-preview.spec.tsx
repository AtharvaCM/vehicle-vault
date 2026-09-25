import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AttentionPreview } from './attention-preview';

describe('AttentionPreview', () => {
  it('shows late, today and this-week rows counted from today, and nothing to press', () => {
    render(<AttentionPreview />);

    const preview = screen.getByRole('figure', {
      name: 'An example of the Needs attention list on Home',
    });
    const rows = within(preview).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('3 days late');
    expect(rows[1]).toHaveTextContent('Today');
    expect(rows[2]).toHaveTextContent('5 days left');
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
    expect(within(preview).queryByRole('link')).not.toBeInTheDocument();
  });
});
