import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  vi.useRealTimers();
});

describe('AccessoryCard warranty wording', () => {
  it('reads as ended the day after expiry, in IST', () => {
    // The regression: comparing a local-midnight "today" against the UTC-midnight
    // instant the API sends put every IST result a day high, so a warranty that
    // ended yesterday still claimed to be current.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T18:45:00.000Z')); // 2026-07-06 00:15 IST

    render(
      <AccessoryCard
        accessory={{ ...base, warrantyExpiresAt: '2026-07-05T00:00:00.000Z' }}
        onDelete={noopAsync}
        onEdit={noop}
      />,
    );

    expect(screen.getByText(/Warranty ended/)).toBeTruthy();
  });

  it('still reads as current on the expiry day itself', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-05T18:45:00.000Z')); // 2026-07-06 00:15 IST

    render(
      <AccessoryCard
        accessory={{ ...base, warrantyExpiresAt: '2026-07-06T00:00:00.000Z' }}
        onDelete={noopAsync}
        onEdit={noop}
      />,
    );

    expect(screen.getByText(/Warranty until/)).toBeTruthy();
  });

  it('shows the odometer reading captured at fitment', () => {
    render(<AccessoryCard accessory={base} onDelete={noopAsync} onEdit={noop} />);

    expect(screen.getByText(/5,120 km/)).toBeTruthy();
  });
});
