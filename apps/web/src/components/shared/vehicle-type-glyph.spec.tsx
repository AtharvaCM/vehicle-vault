import { render, screen } from '@testing-library/react';
import { VehicleType } from '@vehicle-vault/shared';
import { describe, expect, it } from 'vitest';

import { VehicleTypeGlyph, vehicleGlyphKind } from './vehicle-type-glyph';

describe('vehicleGlyphKind', () => {
  it('gives each vehicle type its glyph', () => {
    expect(vehicleGlyphKind(VehicleType.Car)).toBe('car');
    expect(vehicleGlyphKind(VehicleType.SUV)).toBe('suv');
    expect(vehicleGlyphKind(VehicleType.Van)).toBe('van');
    expect(vehicleGlyphKind(VehicleType.Truck)).toBe('truck');
    expect(vehicleGlyphKind(VehicleType.Other)).toBe('car');
  });

  it('draws a two-wheeler as a scooter only when its catalog variant says so', () => {
    expect(vehicleGlyphKind(VehicleType.Motorcycle, 'Scooter')).toBe('scooter');
    expect(vehicleGlyphKind(VehicleType.Motorcycle, ' scooter ')).toBe('scooter');
    expect(vehicleGlyphKind(VehicleType.Motorcycle, 'Cruiser')).toBe('motorcycle');
    expect(vehicleGlyphKind(VehicleType.Motorcycle, null)).toBe('motorcycle');
    expect(vehicleGlyphKind(VehicleType.Motorcycle)).toBe('motorcycle');
  });
});

describe('VehicleTypeGlyph', () => {
  it('is an image named for its kind, or hidden beside words that name the vehicle', () => {
    const { rerender } = render(<VehicleTypeGlyph kind="scooter" />);
    expect(screen.getByRole('img', { name: 'Scooter' })).toHaveAttribute('data-glyph', 'scooter');

    rerender(<VehicleTypeGlyph decorative kind="scooter" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
