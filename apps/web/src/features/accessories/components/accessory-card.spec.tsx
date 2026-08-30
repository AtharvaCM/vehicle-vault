import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AccessoryCard } from './accessory-card';

const base = {
  id: 'accessory-1',
  vehicleId: 'vehicle-1',
  name: 'Dashcam',
  brand: '70mai',
  category: 'electronics',
  purchaseDate: '2026-07-04T00:00:00.000Z',
  cost: 7499,
  currencyCode: 'INR',
  fittedDate: '2026-07-06T00:00:00.000Z',
  fittedOdometer: 5120,
  removedDate: null,
  removedOdometer: null,
  warrantyExpiresAt: null,
  notes: null,
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
};

const noop = () => undefined;
const noopAsync = async () => undefined;

describe('AccessoryCard', () => {
  it('shows the odometer reading captured at fitment', () => {
    render(<AccessoryCard accessory={base} onDelete={noopAsync} onEdit={noop} />);

    expect(screen.getByText(/5,120 km/)).toBeTruthy();
  });

  it('marks a still-fitted accessory as fitted', () => {
    // Scoped to the badge: "Fitted" is also a field label in the card body.
    const { container } = render(
      <AccessoryCard accessory={base} onDelete={noopAsync} onEdit={noop} />,
    );

    expect(container.querySelector('[data-slot="badge"]')?.textContent).toBe('Fitted');
  });

  it('marks an accessory that was bought but never installed', () => {
    const { container } = render(
      <AccessoryCard
        accessory={{ ...base, fittedDate: null, fittedOdometer: null }}
        onDelete={noopAsync}
        onEdit={noop}
      />,
    );

    expect(container.querySelector('[data-slot="badge"]')?.textContent).toBe('Not fitted');
  });

  it('marks a removed accessory as removed', () => {
    const { container } = render(
      <AccessoryCard
        accessory={{
          ...base,
          removedDate: '2026-08-01T00:00:00.000Z',
          removedOdometer: 6000,
        }}
        onDelete={noopAsync}
        onEdit={noop}
      />,
    );

    expect(container.querySelector('[data-slot="badge"]')?.textContent).toBe('Removed');
  });
});
