import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NumberPlate } from './number-plate';
import { VehicleIdentity } from './vehicle-identity';

function plate() {
  return document.querySelector<HTMLElement>('[data-slot="number-plate"]')!;
}

describe('NumberPlate', () => {
  it('prints an unformatted registration spaced as a plate', () => {
    render(<NumberPlate electric={false} registration="mh12dm0002" />);

    expect(screen.getByText('MH 12 DM 0002')).toBeInTheDocument();
  });

  it('spaces a Bharat series plate', () => {
    render(<NumberPlate electric={false} registration="22bh1234aa" />);

    expect(screen.getByText('22 BH 1234 AA')).toBeInTheDocument();
  });

  it('is announced spelled out, not as the printed words', () => {
    render(<NumberPlate electric={false} registration="MH12DM0002" />);

    // The printed number is hidden from assistive technology; the spelled one is read instead.
    expect(screen.getByText('MH 12 DM 0002')).toHaveAttribute('aria-hidden', 'true');
    const spoken = screen.getByText('M H, 1 2, D M, 0 0 0 2');
    expect(spoken).toHaveClass('sr-only');
    // And it stays out of a selection, so copying the plate copies "MH 12 DM 0002" alone.
    expect(spoken).toHaveClass('select-none');
  });

  it('draws the four sizes at the heights the spec gives', () => {
    const heights = { sm: '22px', md: '36px', lg: '56px', xl: '72px' } as const;

    for (const [size, height] of Object.entries(heights)) {
      const { unmount } = render(
        <NumberPlate
          electric={false}
          registration="MH12DM0002"
          size={size as keyof typeof heights}
        />,
      );
      expect(plate()).toHaveStyle({ height });
      unmount();
    }
  });

  it('carries "IND" on the strip from L up only', () => {
    const { rerender } = render(
      <NumberPlate electric={false} registration="MH12DM0002" size="md" />,
    );
    expect(screen.queryByText('IND')).not.toBeInTheDocument();

    rerender(<NumberPlate electric={false} registration="MH12DM0002" size="lg" />);
    expect(screen.getByText('IND')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is green for an electric vehicle, and says so', () => {
    render(<NumberPlate electric registration="KA01EV2024" />);

    expect(plate()).toHaveAttribute('data-variant', 'electric');
    expect(plate()).toHaveClass('bg-plate-ev', 'text-plate-ev-ink');
    expect(screen.getByText('K A, 0 1, E V, 2 0 2 4, electric')).toBeInTheDocument();
  });

  it('stays a white plate whatever the theme (plate tokens, not surface ones)', () => {
    render(<NumberPlate electric={false} registration="MH12DM0002" />);

    expect(plate()).toHaveClass('bg-plate', 'text-plate-ink', 'border-plate-ink');
  });

  it('draws a dashed empty plate when there is no number', () => {
    render(<NumberPlate electric={false} emptyLabel="Add a vehicle" registration="" />);

    expect(plate()).toHaveAttribute('data-variant', 'empty');
    expect(plate()).toHaveClass('border-dashed');
    expect(screen.getByText('Add a vehicle')).toHaveClass('sr-only');
  });
});

describe('VehicleIdentity', () => {
  it('puts an L plate beside the page heading in the header layout', () => {
    render(
      <VehicleIdentity
        electric={false}
        details="Hyundai Creta SX · 18,500 km"
        layout="header"
        name="Family SUV"
        registration="MH12DM0001"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Family SUV' })).toBeInTheDocument();
    expect(plate()).toHaveAttribute('data-size', 'lg');
    expect(screen.getByText('Hyundai Creta SX · 18,500 km')).toBeInTheDocument();
  });

  it('uses an M plate on a card and an S plate in a row', () => {
    const { unmount } = render(
      <VehicleIdentity
        electric={false}
        layout="card"
        name="Daily Hatch"
        registration="MH12DM0002"
      />,
    );
    expect(plate()).toHaveAttribute('data-size', 'md');
    unmount();

    render(<VehicleIdentity electric={false} name="Weekend Bike" registration="MH12DM0003" />);
    expect(plate()).toHaveAttribute('data-size', 'sm');
    expect(screen.getByText('Weekend Bike')).toBeInTheDocument();
  });

  it('lets the caller choose the heading level', () => {
    render(
      <VehicleIdentity
        electric={false}
        layout="card"
        name="Second Car"
        nameAs="h3"
        registration="MH12DM0004"
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Second Car' })).toBeInTheDocument();
  });
});
