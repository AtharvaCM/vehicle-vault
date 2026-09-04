import { render, screen } from '@testing-library/react';
import { Wrench } from 'lucide-react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { VehiclePickerMenu } from './vehicle-picker-menu';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to?: string;
  }) => (
    <a
      data-params={params ? JSON.stringify(params) : undefined}
      data-search={search ? JSON.stringify(search) : undefined}
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
}));

const buildLink = (vehicleId: string) =>
  ({ to: '/vehicles/$vehicleId/maintenance/new', params: { vehicleId } }) as never;

describe('VehiclePickerMenu', () => {
  it('renders nothing without vehicles', () => {
    const { container } = render(
      <VehiclePickerMenu buildLink={buildLink} icon={Wrench} label="Log service" vehicles={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('links straight to the only vehicle', () => {
    render(
      <VehiclePickerMenu
        buildLink={buildLink}
        icon={Wrench}
        label="Log service"
        vehicles={[{ id: 'vehicle-1', displayName: 'Daily driver', registrationNumber: 'MH12AB1234' }]}
      />,
    );

    const link = screen.getByRole('link', { name: 'Log service' });

    expect(link).toHaveAttribute('href', '/vehicles/$vehicleId/maintenance/new');
    expect(link).toHaveAttribute('data-params', JSON.stringify({ vehicleId: 'vehicle-1' }));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a menu trigger when several vehicles exist', () => {
    render(
      <VehiclePickerMenu
        buildLink={buildLink}
        icon={Wrench}
        label="Log service"
        vehicles={[
          { id: 'vehicle-1', displayName: 'Daily driver', registrationNumber: 'MH12AB1234' },
          { id: 'vehicle-2', displayName: 'Weekend bike', registrationNumber: 'MH12ZZ0001' },
        ]}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Log service' });

    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
