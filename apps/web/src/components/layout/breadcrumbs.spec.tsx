import { render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const match = vi.hoisted(() => ({
  current: { fullPath: '/home', params: {} as Record<string, string> },
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to?: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (href, [key, value]) => href?.replace(`$${key}`, value),
        to,
      )}
      {...props}
    >
      {children}
    </a>
  ),
  useMatches: ({ select }: { select: (matches: unknown[]) => unknown }) => select([match.current]),
}));
vi.mock('@/features/vehicles/hooks/use-vehicle', () => ({
  useVehicle: (vehicleId: string) => ({
    data: vehicleId
      ? { id: vehicleId, nickname: 'Family SUV', make: 'Hyundai', model: 'Creta' }
      : undefined,
  }),
}));
vi.mock('@/features/maintenance/hooks/use-maintenance-record', () => ({
  useMaintenanceRecord: () => ({ data: { id: 'r1', vehicleId: 'v1' } }),
}));
vi.mock('@/features/reminders/hooks/use-reminder', () => ({
  useReminder: () => ({ data: undefined }),
}));

import { Breadcrumbs } from './breadcrumbs';

function trail() {
  const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
  return within(nav)
    .getAllByRole('listitem')
    .map((item) => item.textContent)
    .filter(Boolean);
}

describe('Breadcrumbs', () => {
  beforeEach(() => {
    match.current = { fullPath: '/home', params: {} };
  });

  it('shows nothing but the fallback on a top-level page', () => {
    render(<Breadcrumbs fallback={<span>logo</span>} />);

    expect(screen.getByText('logo')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('puts a vehicle under the Garage, named by its nickname', () => {
    match.current = { fullPath: '/vehicles/$vehicleId', params: { vehicleId: 'v1' } };
    render(<Breadcrumbs />);

    expect(trail()).toEqual(['Garage', 'Family SUV']);
    expect(screen.getByText('Family SUV')).toHaveAttribute('aria-current', 'page');
  });

  it('files a service record under its vehicle: Garage / Family SUV / Service record', () => {
    match.current = { fullPath: '/maintenance-records/$recordId', params: { recordId: 'r1' } };
    render(<Breadcrumbs />);

    expect(trail()).toEqual(['Garage', 'Family SUV', 'Service record']);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByRole('link', { name: 'Family SUV' })).toHaveAttribute(
      'href',
      '/vehicles/v1',
    );
  });

  it('shortens to the way back on a phone', () => {
    match.current = {
      fullPath: '/maintenance-records/$recordId/edit',
      params: { recordId: 'r1' },
    };
    render(<Breadcrumbs />);

    // The phone link is the one outside the breadcrumb nav.
    const back = screen
      .getAllByRole('link', { name: 'Service record' })
      .find((link) => !link.closest('nav'));
    expect(back).toHaveAttribute('href', '/maintenance-records/r1');
    expect(back).toHaveClass('md:hidden');
  });

  it('says "Vehicle" until a reminder has told it which vehicle', () => {
    match.current = { fullPath: '/reminders/$reminderId', params: { reminderId: 'm1' } };
    render(<Breadcrumbs />);

    expect(trail()).toEqual(['Garage', 'Vehicle', 'Reminder']);
  });

  it('puts the settings sub-pages under Settings', () => {
    match.current = { fullPath: '/settings/preferences', params: {} };
    render(<Breadcrumbs />);

    expect(trail()).toEqual(['Settings', 'Notification preferences']);
  });
});
