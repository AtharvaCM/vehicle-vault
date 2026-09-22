import { render, screen, within } from '@testing-library/react';
import {
  MaintenanceCategory,
  MaintenanceRecordStatus,
  MaintenanceSource,
  VehicleRole,
  type MaintenanceRecord,
} from '@vehicle-vault/shared';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { VehicleAccessProvider } from '@/features/vehicles/context/vehicle-access';

import { MaintenanceRecordCard } from './maintenance-record-card';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params: _params,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { params?: Record<string, string>; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const record: MaintenanceRecord = {
  id: 'record-1',
  vehicleId: 'vehicle-1',
  serviceDate: '2026-03-21T00:00:00.000Z',
  odometer: 12_000,
  category: MaintenanceCategory.EngineOil,
  workshopName: 'Torque Garage',
  totalCost: 3_200,
  createdAt: '2026-03-21T00:00:00.000Z',
  updatedAt: '2026-03-21T00:00:00.000Z',
};

/** What the upload-first flow leaves behind once "Apply to Draft" has run. */
const draft: MaintenanceRecord = {
  ...record,
  source: MaintenanceSource.Ocr,
  status: MaintenanceRecordStatus.Draft,
};

function renderAs(role: VehicleRole, data: MaintenanceRecord) {
  return render(
    <VehicleAccessProvider role={role}>
      <MaintenanceRecordCard record={data} />
    </VehicleAccessProvider>,
  );
}

describe('MaintenanceRecordCard drafts', () => {
  it('marks a draft, which counts in no cost, report or reminder', () => {
    renderAs(VehicleRole.Owner, draft);

    const recordLink = screen.getByRole('link', { name: /torque garage/i });
    expect(within(recordLink).getByText('Draft')).toBeInTheDocument();
    expect(
      screen.getByText('Not counted in costs, reports or reminders until it is confirmed.'),
    ).toBeInTheDocument();
  });

  it.each([VehicleRole.Owner, VehicleRole.Editor])(
    'sends an %s from a draft to the page that confirms it',
    (role) => {
      renderAs(role, draft);

      const review = screen.getByRole('link', { name: 'Review and confirm' });
      expect(review).toHaveAttribute('href', '/maintenance-records/$recordId/edit');
      // Its own link, not one nested inside the card's link to the record.
      expect(screen.getByRole('link', { name: /torque garage/i })).not.toContainElement(review);
    },
  );

  it('tells a viewer who can confirm it, without offering to', () => {
    renderAs(VehicleRole.Viewer, draft);

    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Not counted in costs, reports or reminders until an owner or editor confirms it.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review and confirm' })).not.toBeInTheDocument();
  });

  it.each([
    ['a confirmed record', { ...record, status: MaintenanceRecordStatus.Confirmed }],
    ['a record from an API that sends no status', record],
  ])('leaves %s unmarked', (_label, data) => {
    renderAs(VehicleRole.Owner, data);

    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Review and confirm' })).not.toBeInTheDocument();
  });
});
