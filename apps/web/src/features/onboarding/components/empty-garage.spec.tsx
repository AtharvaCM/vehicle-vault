import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyGarage } from './empty-garage';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, className }: Record<string, unknown>) => (
    <a className={className as string} href={to as string}>
      {children as React.ReactNode}
    </a>
  ),
}));

describe('EmptyGarage', () => {
  it('says what to do, where invites come in, and previews the reminders', () => {
    render(<EmptyGarage />);

    expect(screen.getByRole('heading', { name: 'Your garage is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/new',
    );
    expect(screen.getByText('Have an invite? Open the link from your email.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'An example of your reminders' })).toHaveTextContent(
      'Insurance renewal',
    );
  });

  it('leaves the button to the checklist on Home', () => {
    render(<EmptyGarage withAction={false} />);

    expect(screen.queryByRole('link', { name: 'Add your vehicle' })).not.toBeInTheDocument();
  });
});
