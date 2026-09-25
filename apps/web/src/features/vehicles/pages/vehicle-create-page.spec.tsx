import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FuelType, VehicleType, type Vehicle } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appToast } from '@/lib/toast';

const navigateMock = vi.hoisted(() => vi.fn());
const createVehicleMutateAsync = vi.hoisted(() => vi.fn());
const setupPromptProps = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ catalog: undefined }),
}));

vi.mock('@/features/catalog-intent/hooks/use-catalog-intent-prefill', () => ({
  useCatalogIntentPrefill: () => ({ status: 'empty' }),
}));

vi.mock('../hooks/use-create-vehicle', () => ({
  useCreateVehicle: () => ({
    mutateAsync: createVehicleMutateAsync,
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({ allowNextNavigation: () => () => undefined }),
}));

vi.mock('@/lib/toast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../components/vehicle-form', () => ({
  VehicleForm: (props: Record<string, unknown>) => {
    const onSubmit = props.onSubmit as (values: Record<string, unknown>) => Promise<void> | void;

    return (
      <button
        onClick={() => {
          void Promise.resolve(onSubmit({ make: 'Hyundai', model: 'Creta' })).catch(() => {
            // The page itself reports the failure (toast); nothing more to do here.
          });
        }}
        type="button"
      >
        Save vehicle
      </button>
    );
  },
}));

vi.mock('../components/vehicle-setup-prompt', () => ({
  VehicleSetupPrompt: (props: Record<string, unknown>) => {
    setupPromptProps.current = props;
    const onDismissed = props.onDismissed as (() => void) | undefined;

    return (
      <button onClick={() => onDismissed?.()} type="button">
        Skip for now
      </button>
    );
  },
}));

import { VehicleCreatePage } from './vehicle-create-page';

function createdVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'vehicle-1',
    registrationNumber: 'MH12AB1234',
    make: 'Hyundai',
    model: 'Creta',
    year: 2022,
    vehicleType: VehicleType.SUV,
    fuelType: FuelType.Petrol,
    odometer: 1200,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    setupPromptDismissedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupPromptProps.current = undefined;
});

describe('VehicleCreatePage papers step', () => {
  it('shows the setup prompt instead of navigating right after saving', async () => {
    createVehicleMutateAsync.mockResolvedValue(createdVehicle());
    render(<VehicleCreatePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));

    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(setupPromptProps.current).toMatchObject({
      vehicleId: 'vehicle-1',
      fuelType: FuelType.Petrol,
      dismissedAt: null,
    });
  });

  it('navigates to the vehicle once the prompt is answered or skipped', async () => {
    createVehicleMutateAsync.mockResolvedValue(createdVehicle());
    render(<VehicleCreatePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/vehicles/$vehicleId',
      params: { vehicleId: 'vehicle-1' },
    });
  });

  it('skips the prompt and navigates straight away against an API that predates it', async () => {
    // `setupPromptDismissedAt` omitted, not null: an older API cannot save an
    // answer to a prompt it does not know about.
    createVehicleMutateAsync.mockResolvedValue(
      createdVehicle({ setupPromptDismissedAt: undefined }),
    );
    render(<VehicleCreatePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/vehicles/$vehicleId',
      params: { vehicleId: 'vehicle-1' },
    });
  });

  it('shows an error toast and stays on the form when creation fails', async () => {
    createVehicleMutateAsync.mockRejectedValue(new Error('nope'));
    render(<VehicleCreatePage />);

    await userEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));

    expect(appToast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Unable to create vehicle' }),
    );
    expect(screen.queryByRole('button', { name: 'Skip for now' })).not.toBeInTheDocument();
  });
});
