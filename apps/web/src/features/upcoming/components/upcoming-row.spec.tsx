import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes } from 'react';
import { ReminderType, type UpcomingItem } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import { UpcomingRow } from './upcoming-row';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    params,
    search,
    to,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    params?: Record<string, string>;
    search?: Record<string, string>;
    to?: string;
  }) => (
    <a
      data-params={params ? JSON.stringify(params) : undefined}
      data-search={search ? JSON.stringify(search) : undefined}
      href={to}
      {...props}
    >
      {children}
    </a>
  ),
}));

function makeItem(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
  return {
    id: 'reminder-1',
    kind: 'reminder',
    urgency: 'this_week',
    vehicleId: 'vehicle-1',
    vehicleName: 'Daily driver',
    registrationNumber: 'MH12AB1234',
    currentUserRole: 'owner',
    title: 'Engine oil change',
    reminderType: ReminderType.Service,
    dueDate: '2026-09-28T00:00:00.000Z',
    daysUntilDue: 3,
    ...overrides,
  };
}

const noop = () => {};

describe('UpcomingRow', () => {
  it('renders the plate when showVehicle is true, and hides it otherwise', () => {
    const { rerender } = render(
      <UpcomingRow
        isPending={false}
        item={makeItem()}
        onComplete={noop}
        onSnoozePaper={noop}
        onSnoozeReminder={noop}
        showVehicle
      />,
    );

    expect(screen.getByText('MH 12 AB 1234')).toBeInTheDocument();

    rerender(
      <UpcomingRow
        isPending={false}
        item={makeItem()}
        onComplete={noop}
        onSnoozePaper={noop}
        onSnoozeReminder={noop}
        showVehicle={false}
      />,
    );

    expect(screen.queryByText('MH 12 AB 1234')).not.toBeInTheDocument();
  });

  it('sets the root data attributes and the pending state', () => {
    render(
      <UpcomingRow
        isPending
        item={makeItem({ reminderType: ReminderType.Insurance })}
        onComplete={noop}
        onSnoozePaper={noop}
        onSnoozeReminder={noop}
        showVehicle
      />,
    );

    const row = screen.getByTestId('upcoming-row');

    expect(row).toHaveAttribute('data-kind', 'reminder');
    expect(row.className).toContain('opacity-50');
    expect(screen.getByRole('button', { name: /mark .* done/i })).toBeDisabled();
  });

  describe('reminder rows', () => {
    it('offers Log service as the primary action for a service reminder, filled when late/this week', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();
      const onSnoozeReminder = vi.fn();

      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ reminderType: ReminderType.Service, urgency: 'overdue' })}
          onComplete={onComplete}
          onSnoozePaper={noop}
          onSnoozeReminder={onSnoozeReminder}
          showVehicle
        />,
      );

      const logService = screen.getByRole('link', { name: 'Log service' });
      expect(logService).toHaveAttribute('href', '/vehicles/$vehicleId/maintenance/new');
      expect(logService.className).toContain('bg-brand');

      await user.click(screen.getByRole('button', { name: 'More actions for Engine oil change' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Mark done' }));
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'reminder-1' }));

      await user.click(screen.getByRole('button', { name: 'More actions for Engine oil change' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Snooze a week' }));
      expect(onSnoozeReminder).toHaveBeenCalledWith(expect.objectContaining({ id: 'reminder-1' }));
    });

    it('outlines Log service when the reminder is not urgent', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ reminderType: ReminderType.Service, urgency: 'later' })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const logService = screen.getByRole('link', { name: 'Log service' });
      expect(logService.className).not.toContain('bg-brand');
    });

    it('offers a Done button for a non-service reminder, with Snooze a week in the overflow', async () => {
      const user = userEvent.setup();
      const onComplete = vi.fn();

      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ reminderType: ReminderType.Insurance, title: 'Renew cover' })}
          onComplete={onComplete}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const done = screen.getByRole('button', { name: 'Mark Renew cover done' });
      await user.click(done);
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ id: 'reminder-1' }));

      await user.click(screen.getByRole('button', { name: 'More actions for Renew cover' }));
      expect(await screen.findByRole('menuitem', { name: 'Snooze a week' })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Mark done' })).not.toBeInTheDocument();
    });

    it('offers only View for a viewer, with no overflow', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ currentUserRole: 'viewer' })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const view = screen.getByRole('link', { name: 'View' });
      expect(view).toHaveAttribute('data-params', JSON.stringify({ reminderId: 'reminder-1' }));
      expect(view).toHaveAttribute('href', '/reminders/$reminderId');
      expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
    });

    it('shows the odometer meta when a reminder has both a date and an odometer due', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ dueOdometer: 45000, kmUntilDue: 800 })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.getByText('at 45,000 km · 800 km to go')).toBeInTheDocument();
    });

    it('falls back to the reminder type label when there is no odometer due', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({ reminderType: ReminderType.Insurance, dueOdometer: undefined })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.getByText('Insurance')).toBeInTheDocument();
    });
  });

  describe('document rows', () => {
    function makeDoc(overrides: Partial<UpcomingItem> = {}): UpcomingItem {
      return makeItem({
        kind: 'document',
        id: 'doc-1',
        title: 'Insurance policy',
        documentKind: 'insurance',
        reminderType: undefined,
        urgency: 'this_week',
        ...overrides,
      });
    }

    it('offers Renew, filled when late/this week, with Snooze in the overflow', async () => {
      const user = userEvent.setup();
      const onSnoozePaper = vi.fn();

      render(
        <UpcomingRow
          isPending={false}
          item={makeDoc()}
          onComplete={noop}
          onSnoozePaper={onSnoozePaper}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const renew = screen.getByRole('link', { name: 'Renew' });
      expect(renew).toHaveAttribute('data-search', JSON.stringify({ tab: 'papers' }));
      expect(renew.className).toContain('bg-brand');

      await user.click(screen.getByRole('button', { name: 'More actions for Insurance policy' }));
      await user.click(await screen.findByRole('menuitem', { name: 'Snooze' }));
      expect(onSnoozePaper).toHaveBeenCalledWith(expect.objectContaining({ id: 'doc-1' }));
    });

    it('offers View papers, outlined, for a viewer, but keeps Snooze available', async () => {
      const user = userEvent.setup();

      render(
        <UpcomingRow
          isPending={false}
          item={makeDoc({ currentUserRole: 'viewer' })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const viewPapers = screen.getByRole('link', { name: 'View papers' });
      expect(viewPapers.className).not.toContain('bg-brand');

      await user.click(screen.getByRole('button', { name: 'More actions for Insurance policy' }));
      expect(await screen.findByRole('menuitem', { name: 'Snooze' })).toBeInTheDocument();
    });

    it('hides Snooze once a paper is already snoozed', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeDoc({ snoozedUntil: '2026-10-05T00:00:00.000Z' })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
      expect(screen.getByText('Snoozed until Mon 5 Oct')).toBeInTheDocument();
    });

    it('hides Snooze once a paper is actually overdue', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeDoc({ urgency: 'overdue', daysUntilDue: -2 })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.queryByRole('button', { name: /more actions/i })).not.toBeInTheDocument();
    });

    it('shows the provider, then falls back to the badge noun', () => {
      const { rerender } = render(
        <UpcomingRow
          isPending={false}
          item={makeDoc({ provider: 'Bharat Petroleum' })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.getByText('Bharat Petroleum')).toBeInTheDocument();

      rerender(
        <UpcomingRow
          isPending={false}
          item={makeDoc({ provider: undefined })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.getByText('Insurance policy', { selector: 'p' })).toBeInTheDocument();
    });
  });

  describe('other kinds', () => {
    it('links a loan EMI row to the loan, with the amount as its secondary line', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({
            kind: 'loan_emi',
            id: 'emi-1',
            title: 'Loan EMI',
            reminderType: undefined,
            amount: 12500,
          })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      const link = screen.getByRole('link', { name: 'View loan' });
      expect(link).toHaveAttribute(
        'data-search',
        JSON.stringify({ tab: 'more', section: 'loans' }),
      );
      expect(screen.getByText('₹12,500')).toBeInTheDocument();
    });

    it('shows the verdict detail for a tyre row and links to View tyres', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({
            kind: 'tyre',
            id: 'tyre:fl',
            title: 'Tyre not roadworthy',
            reminderType: undefined,
            dueDate: null,
            daysUntilDue: null,
            detail: 'Front left · 1.4 mm tread',
            urgency: 'overdue',
          })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      // Undated verdict: the same wording is both the secondary line and the "when" words.
      expect(screen.getAllByText('Front left · 1.4 mm tread').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'View tyres' })).toHaveAttribute(
        'data-search',
        JSON.stringify({ tab: 'more', section: 'tyres' }),
      );
    });

    it('adds history for a service baseline row', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({
            kind: 'service_baseline',
            id: 'service-history:vehicle-1',
            title: 'Service history unknown',
            reminderType: undefined,
            dueDate: null,
            daysUntilDue: null,
            detail: 'No service on file',
            urgency: 'this_month',
          })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      // Undated verdict: the same wording is both the secondary line and the "when" words.
      expect(screen.getAllByText('No service on file').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'Add history' })).toBeInTheDocument();
    });

    it('names an accessory warranty in its secondary line and links to View accessory', () => {
      render(
        <UpcomingRow
          isPending={false}
          item={makeItem({
            kind: 'accessory',
            id: 'accessory:acc-1',
            title: '70mai Dashcam warranty',
            reminderType: undefined,
          })}
          onComplete={noop}
          onSnoozePaper={noop}
          onSnoozeReminder={noop}
          showVehicle
        />,
      );

      expect(screen.getByText('Accessory warranty')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View accessory' })).toHaveAttribute(
        'data-search',
        JSON.stringify({ tab: 'more', section: 'accessories' }),
      );
    });
  });
});
