import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import {
  FuelType,
  MaintenanceCategory,
  VehicleType,
  type PublicCatalogVariantPage,
} from '@vehicle-vault/shared';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RunningCostCalculator, parseEntered } from './running-cost-calculator';

const STORAGE_KEY = 'vehicle-vault.running-cost:cars/maruti/swift/swift-lineup/vxi';

function variantPage(overrides: Partial<PublicCatalogVariantPage> = {}): PublicCatalogVariantPage {
  return {
    segment: 'cars',
    vehicleType: VehicleType.Car,
    make: { name: 'Maruti', slug: 'maruti' },
    model: { name: 'Swift', slug: 'swift' },
    generation: {
      name: 'Swift lineup',
      slug: 'swift-lineup',
      yearStart: 2024,
      yearEnd: null,
      isCurrent: true,
    },
    variant: { name: 'VXi', slug: 'vxi' },
    offerings: [{ fuelTypes: [FuelType.Petrol], yearStart: 2024, yearEnd: null, isCurrent: true }],
    specs: null,
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Petrol,
      vehicleType: VehicleType.Car,
      items: [
        { category: MaintenanceCategory.PeriodicService, km: 10000, months: 12, source: 'default' },
        { category: MaintenanceCategory.EngineOil, km: 7500, months: 6, source: 'default' },
      ],
    },
    calculatorSeed: {
      fuelType: FuelType.Petrol,
      claimedMileage: 25,
      claimedRangeKm: null,
      batteryKwh: null,
    },
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function electricPage() {
  return variantPage({
    variant: { name: 'EV', slug: 'ev' },
    schedule: {
      basis: 'typical',
      fuelType: FuelType.Electric,
      vehicleType: VehicleType.Car,
      items: [
        { category: MaintenanceCategory.PeriodicService, km: 15000, months: 12, source: 'default' },
      ],
    },
    calculatorSeed: {
      fuelType: FuelType.Electric,
      claimedMileage: null,
      claimedRangeKm: 300,
      batteryKwh: 30,
    },
  });
}

function period(name: string) {
  return screen.getByRole('region', { name });
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('RunningCostCalculator', () => {
  it('opens on the claimed mileage and the default price for the fuel, marked as assumed', () => {
    render(<RunningCostCalculator page={variantPage()} />);

    expect(screen.getByLabelText('Mileage')).toHaveValue('25');
    expect(screen.getByLabelText('Mileage')).toHaveAccessibleDescription(
      /km\/L Assumed · the maker’s claimed figure/,
    );
    expect(screen.getByLabelText('Petrol price')).toHaveValue('103');
    expect(screen.getByLabelText('Petrol price')).toHaveAccessibleDescription(/per L/);
    expect(screen.getByLabelText('Distance per month')).toHaveValue('1000');
    expect(screen.getByLabelText('Service cost per visit')).toHaveValue('5000');
    expect(screen.getByLabelText('Years of ownership')).toHaveValue('5');
    expect(screen.getByLabelText('On-road price (optional)')).toHaveValue('');
  });

  it('shows monthly, yearly and N-year totals split into fuel and service', () => {
    render(<RunningCostCalculator page={variantPage()} />);

    // 1,000 km ÷ 25 km/L × ₹103 = ₹4,120 of fuel; 1.2 services a year at ₹5,000 = ₹500 a month.
    const month = period('Per month');
    expect(within(month).getByText('₹4,620')).toBeInTheDocument();
    expect(within(month).getByText('Fuel').nextSibling).toHaveTextContent('₹4,120');
    expect(within(month).getByText('Service').nextSibling).toHaveTextContent('₹500');
    expect(within(month).queryByText('Purchase')).not.toBeInTheDocument();
    expect(within(period('Per year')).getByText('₹55,440')).toBeInTheDocument();
    expect(within(period('Over 5 years')).getByText('₹2,77,200')).toBeInTheDocument();
    expect(screen.getByText(/Assumed, not entered:/)).toHaveTextContent(
      'the claimed 25 km/L; petrol price of ₹103 per L (September 2026)',
    );
  });

  it('adds the purchase when an on-road price is entered, and marks entered figures as yours', () => {
    render(<RunningCostCalculator page={variantPage()} />);

    type('On-road price (optional)', '9,00,000');
    type('Distance per month', '1500');

    expect(within(period('Over 5 years')).getByText('Purchase').nextSibling).toHaveTextContent(
      '₹9,00,000',
    );
    expect(within(period('Per month')).getByText('Purchase').nextSibling).toHaveTextContent(
      '₹15,000',
    );
    expect(screen.getByLabelText('Distance per month')).toHaveAccessibleDescription(
      /km Your figure/,
    );
    expect(screen.getByText(/Assumed, not entered:/)).not.toHaveTextContent('km a month');
  });

  it('works in kWh per 100 km and a price per kWh for an EV', () => {
    render(<RunningCostCalculator page={electricPage()} />);

    expect(screen.getByLabelText('Energy use')).toHaveValue('10');
    expect(screen.getByLabelText('Energy use')).toHaveAccessibleDescription(/kWh\/100 km/);
    expect(screen.getByLabelText('Electricity price')).toHaveValue('9');
    expect(screen.getByLabelText('Electricity price')).toHaveAccessibleDescription(/per kWh/);
    // 1,000 km × 10 kWh/100 km × ₹9 = ₹900.
    expect(within(period('Per month')).getByText('Electricity').nextSibling).toHaveTextContent(
      '₹900',
    );
  });

  it.each([
    ['0', 'Distance per month needs to be between 1 and 20,000 km.'],
    ['-40', 'Distance per month needs to be between 1 and 20,000 km.'],
    ['9999999', 'Distance per month needs to be between 1 and 20,000 km.'],
    ['lots', 'Distance per month needs to be a number.'],
    ['', 'Enter distance per month.'],
  ])('shows a can’t-estimate state for %j km a month, with no NaN', (value, message) => {
    render(<RunningCostCalculator page={variantPage()} />);

    type('Distance per month', value);

    expect(screen.getByRole('heading', { name: 'Can’t estimate yet' })).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('Distance per month')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('region', { name: 'Per month' })).not.toBeInTheDocument();
    expect(screen.getByTestId('running-cost-calculator')).not.toHaveTextContent('NaN');
  });

  it('asks for a mileage when the catalog has none', () => {
    render(
      <RunningCostCalculator
        page={variantPage({
          calculatorSeed: {
            fuelType: FuelType.Petrol,
            claimedMileage: null,
            claimedRangeKm: null,
            batteryKwh: null,
          },
        })}
      />,
    );

    expect(screen.getByLabelText('Mileage')).toHaveValue('');
    expect(screen.getByLabelText('Mileage')).toHaveAccessibleDescription(/Enter your figure/);
    expect(screen.getByText('Enter mileage.')).toBeInTheDocument();

    type('Mileage', '18');

    expect(screen.queryByText('Can’t estimate yet')).not.toBeInTheDocument();
  });

  it('keeps entered figures per variant and restores them on the next visit', () => {
    const { unmount } = render(<RunningCostCalculator page={variantPage()} />);
    type('Mileage', '19.5');
    type('On-road price (optional)', '800000');

    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      efficiency: '19.5',
      onRoadPrice: '800000',
    });
    unmount();

    render(<RunningCostCalculator page={variantPage()} />);
    expect(screen.getByLabelText('Mileage')).toHaveValue('19.5');
    expect(screen.getByLabelText('On-road price (optional)')).toHaveValue('800000');
  });

  it('does not carry one variant’s figures to another', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ efficiency: '12' }));

    render(<RunningCostCalculator page={electricPage()} />);

    expect(screen.getByLabelText('Energy use')).toHaveValue('10');
  });

  it('resets to the assumed figures and forgets the saved ones', () => {
    render(<RunningCostCalculator page={variantPage()} />);
    type('Mileage', '19');

    fireEvent.click(screen.getByRole('button', { name: 'Reset to the assumed figures' }));

    expect(screen.getByLabelText('Mileage')).toHaveValue('25');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores a corrupt saved entry', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');

    render(<RunningCostCalculator page={variantPage()} />);

    expect(screen.getByLabelText('Mileage')).toHaveValue('25');
  });

  it('still works when localStorage throws', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(blocked);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(blocked);
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(blocked);

    render(<RunningCostCalculator page={variantPage()} />);
    type('Distance per month', '2000');

    expect(within(period('Per month')).getByText('Fuel').nextSibling).toHaveTextContent('₹8,240');
  });

  it('renders the defaults on the server and hydrates without a mismatch, then restores', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ efficiency: '19.5' }));
    const element = <RunningCostCalculator page={variantPage()} />;

    const html = renderToString(element);
    expect(html).toContain('value="25"');
    expect(html).not.toContain('19.5');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const onRecoverableError = vi.fn();
    const consoleError = vi.spyOn(console, 'error');
    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const wasActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

    const root = await act(async () => hydrateRoot(container, element, { onRecoverableError }));
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(within(container).getByLabelText('Mileage')).toHaveValue('19.5');
    act(() => root.unmount());
    container.remove();
  });
});

describe('parseEntered', () => {
  it.each([
    ['1000', 1000],
    ['1,00,000', 100000],
    ['₹ 95.5', 95.5],
    [' 20 ', 20],
    ['', null],
    ['   ', null],
  ])('reads %j as %s', (raw, expected) => {
    expect(parseEntered(raw)).toBe(expected);
  });

  it.each(['abc', '12abc', '1.2.3'])('reads %j as not a number', (raw) => {
    expect(parseEntered(raw)).toBeNaN();
  });
});
