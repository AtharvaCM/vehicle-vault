import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useVehicleInsights = vi.hoisted(() => vi.fn());

vi.mock('../hooks/use-vehicle-insights', () => ({ useVehicleInsights }));

import { OdometerForecastCard } from './odometer-forecast-card';

const insights = {
  averageDailyMileage: 16.7,
  averageMonthlyMileage: 508,
  currentOdometerPredicted: 31_667,
  lastRecordedOdometer: 31_500,
  lastRecordedDate: '2026-09-13T06:30:00.000Z',
  daysSinceLastReading: 10,
  dataPointsCount: 3,
  confidence: 'medium' as const,
};

describe('OdometerForecastCard', () => {
  it('predicts on from the readings when it can measure a rate', () => {
    useVehicleInsights.mockReturnValue({ data: insights, isLoading: false });

    render(<OdometerForecastCard vehicleId="vehicle-1" />);

    expect(screen.getByText('Predicted current odometer')).toBeInTheDocument();
    expect(screen.getByText(/31,667/)).toBeInTheDocument();
    expect(screen.getByText('16.7 km/day')).toBeInTheDocument();
  });

  it('shows a lone reading as the last recorded one, with no 0 km/day average', () => {
    useVehicleInsights.mockReturnValue({
      data: {
        ...insights,
        averageDailyMileage: 0,
        averageMonthlyMileage: 0,
        currentOdometerPredicted: 12_000,
        lastRecordedOdometer: 12_000,
        dataPointsCount: 1,
        confidence: 'low',
      },
      isLoading: false,
    });

    render(<OdometerForecastCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/12,000/)).toBeInTheDocument();
    expect(screen.getByText(/^Last recorded \(Sep 13, 2026\)/)).toBeInTheDocument();
    expect(screen.queryByText('Predicted current odometer')).not.toBeInTheDocument();
    expect(screen.queryByText(/km\/day/)).not.toBeInTheDocument();
    expect(screen.queryByText(/confidence/)).not.toBeInTheDocument();
  });

  it('does not dress readings that never moved forward up as a prediction', () => {
    // The demo Daily Hatch: 32,000 typed on the vehicle, an older fill at 31,800.
    useVehicleInsights.mockReturnValue({
      data: {
        ...insights,
        averageDailyMileage: 0,
        averageMonthlyMileage: 0,
        currentOdometerPredicted: 32_000,
        lastRecordedOdometer: 32_000,
        dataPointsCount: 2,
        confidence: 'low',
      },
      isLoading: false,
    });

    render(<OdometerForecastCard vehicleId="vehicle-1" />);

    expect(screen.getByText(/32,000/)).toBeInTheDocument();
    expect(screen.queryByText('Predicted current odometer')).not.toBeInTheDocument();
    expect(screen.queryByText(/km\/day/)).not.toBeInTheDocument();
  });
});
