import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    search: _search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: unknown;
    search?: unknown;
    to?: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

import type { AuditEvent } from '../types/audit-event';
import { ActivityFeed, dayLabel } from './activity-feed';

const now = new Date('2026-09-25T12:00:00.000Z');

function event(id: string, occurredAt: string, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id,
    occurredAt,
    action: 'fuel.created',
    actorUserId: 'u1',
    ownerUserId: 'u1',
    resourceType: 'fuel_log',
    resourceId: id,
    before: null,
    after: { vehicleId: 'v1', quantity: 28, totalCost: '2996', odometer: 18500 },
    changedFields: ['quantity'],
    ipAddress: '203.0.113.9',
    userAgent: null,
    actor: { name: 'Asha', isYou: true },
    resourceExists: true,
    ...overrides,
  };
}

function query(events: AuditEvent[]) {
  return {
    isPending: false,
    isError: false,
    data: { pages: [{ events, nextCursor: null }], pageParams: [] },
    hasNextPage: false,
  } as never;
}

describe('dayLabel', () => {
  it('names today and yesterday, then the date', () => {
    expect(dayLabel('2026-09-25T04:00:00.000Z', now)).toBe('Today');
    expect(dayLabel('2026-09-24T04:00:00.000Z', now)).toBe('Yesterday');
    expect(dayLabel('2026-09-20T04:00:00.000Z', now)).toBe('Sunday, 20 September 2026');
  });
});

describe('ActivityFeed', () => {
  it('groups sentences by day, newest first, each linking to its record', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    render(
      <ActivityFeed
        query={query([
          event('a', '2026-09-25T09:00:00.000Z'),
          event('b', '2026-09-24T09:00:00.000Z', { resourceExists: false }),
        ])}
      />,
    );
    vi.useRealTimers();

    const days = screen.getAllByTestId('activity-day');
    expect(days.map((day) => day.getAttribute('aria-label'))).toEqual(['Today', 'Yesterday']);
    const today = within(days[0]!);
    expect(today.getByRole('link', { name: 'You logged a fuel fill' })).toBeInTheDocument();
    expect(days[0]).toHaveTextContent('You logged a fuel fill — 28 L · ₹2,996 · 18,500 km');
    // A fill since deleted is still said, just not linked.
    expect(within(days[1]!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers "Not you?" beside a failed sign-in in the security view', () => {
    render(
      <ActivityFeed
        notYou
        query={query([
          event('f', '2026-09-25T09:00:00.000Z', {
            action: 'auth.login_failed',
            resourceType: 'user',
            after: { reason: 'bad_password' },
          }),
        ])}
      />,
    );

    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('keeps the raw change behind an owner-only switch', () => {
    const { rerender } = render(
      <ActivityFeed query={query([event('a', '2026-09-25T09:00:00.000Z')])} />,
    );
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();

    rerender(
      <ActivityFeed
        allowTechnicalDetails
        query={query([event('a', '2026-09-25T09:00:00.000Z')])}
      />,
    );
    expect(screen.queryByTestId('activity-technical')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Show technical details' }));
    const technical = screen.getByTestId('activity-technical');
    expect(technical).toHaveTextContent('fuel.created');
    expect(technical).toHaveTextContent('IP 203.0.113.9');
  });
});
