import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/cost-split-donut', () => ({
  CostSplitDonut: () => <div data-testid="cost-split-donut" />,
}));
vi.mock('../components/cost-trend-chart', () => ({
  CostTrendChart: () => <div data-testid="cost-trend-chart" />,
}));
vi.mock('../components/vehicle-spend-list', () => ({
  VehicleSpendList: () => <div data-testid="vehicle-spend-list" />,
}));
vi.mock('@/features/loans/components/loans-section', () => ({
  LoansSection: () => <div data-testid="loans-section" />,
}));

import { CostsPage } from './costs-page';

describe('CostsPage', () => {
  it('lays out the title, spend, by-vehicle, and loans sections', () => {
    render(<CostsPage />);

    expect(screen.getByRole('heading', { name: 'Costs', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Spend' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By vehicle' })).toBeInTheDocument();

    expect(screen.getByTestId('cost-split-donut')).toBeInTheDocument();
    expect(screen.getByTestId('cost-trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-spend-list')).toBeInTheDocument();
    expect(screen.getByTestId('loans-section')).toBeInTheDocument();
  });
});
