import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SetupChecklist } from './setup-checklist';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, className }: Record<string, unknown>) => (
    <a
      className={className as string}
      href={String(to).replace('$vehicleId', (params as { vehicleId?: string })?.vehicleId ?? '')}
    >
      {children as React.ReactNode}
    </a>
  ),
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useAuth: () => ({ user: { email: 'asha@example.test' } }),
}));
const resend = vi.fn();
vi.mock('@/features/auth/hooks/use-resend-verification', () => ({
  useResendVerification: () => ({ resend, isResending: false, hasSent: false }),
}));

const NEW_ACCOUNT = [
  { id: 'account' as const, done: true },
  { id: 'vehicle' as const, done: false },
  { id: 'papers' as const, done: false },
  { id: 'service' as const, done: false },
  { id: 'email' as const, done: false },
];

describe('SetupChecklist', () => {
  it('counts what is done, and offers each step before there is a vehicle', () => {
    render(
      <SetupChecklist
        heading="Set up your first reminder"
        steps={NEW_ACCOUNT}
        vehicle={null}
        verifyDaysLeft={7}
      />,
    );

    const checklist = screen.getByRole('region', { name: 'Set up your first reminder' });
    expect(checklist).toHaveTextContent('1 of 5 done');
    const rows = within(checklist).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Create your account (done)');
    expect(within(rows[1]!).getByRole('link', { name: 'Add vehicle' })).toHaveAttribute(
      'href',
      '/vehicles/new',
    );
    expect(rows[2]).toHaveTextContent('After a vehicle');
    expect(rows[4]).toHaveTextContent('Verify your email · 7 days left');
    within(rows[4]!).getByRole('button', { name: 'Resend' }).click();
    expect(resend).toHaveBeenCalled();
  });

  it('opens the papers and service forms of the vehicle once there is one', () => {
    render(
      <SetupChecklist
        heading="Finish setting up"
        steps={NEW_ACCOUNT.map((step) => (step.id === 'vehicle' ? { ...step, done: true } : step))}
        vehicle={{ id: 'v1' }}
        verifyDaysLeft={1}
      />,
    );

    expect(screen.getByRole('link', { name: 'Add dates' })).toHaveAttribute('href', '/vehicles/v1');
    expect(screen.getByRole('link', { name: 'Log service' })).toHaveAttribute(
      'href',
      '/vehicles/v1/maintenance/new',
    );
    expect(screen.getByText(/last day/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add vehicle' })).not.toBeInTheDocument();
  });
});
