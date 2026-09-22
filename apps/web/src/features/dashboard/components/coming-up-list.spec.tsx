import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { makeAttentionItem } from '../test/fixtures';
import { ComingUpList } from './coming-up-list';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to?: string;
  }) => (
    <a data-search={search ? JSON.stringify(search) : undefined} href={to} {...props}>
      {children}
    </a>
  ),
}));

describe('ComingUpList', () => {
  it('lists a question the app is asking beside what is coming up, leading to where it is answered', () => {
    const history = makeAttentionItem({
      id: 'service-history:vehicle-1',
      kind: 'service_baseline',
      urgency: 'this_month',
      title: 'Unknown service history',
      detail: 'Brake pads, coolant and 1 more',
      dueDate: null,
      daysUntilDue: null,
      reminderType: undefined,
      reminderStatus: undefined,
    });

    render(<ComingUpList items={[history]} showVehicle={false} />);

    const row = screen.getByRole('link', { name: /Unknown service history/ });
    expect(row).toHaveTextContent('Brake pads, coolant and 1 more');
    expect(row).toHaveAttribute('data-search', JSON.stringify({ tab: 'maintenance' }));
  });
});
