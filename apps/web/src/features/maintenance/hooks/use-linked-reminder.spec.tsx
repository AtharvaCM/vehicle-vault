import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { ReminderStatus, ReminderType, type Reminder } from '@vehicle-vault/shared';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/lib/query/query-keys';

import { useLinkedReminder } from './use-linked-reminder';

const reminderId = '6f1c2b8e-3d4a-4b5c-9d6e-7f8091a2b3c4';
const now = '2026-09-25T00:00:00.000Z';

const oil: Reminder = {
  id: reminderId,
  vehicleId: 'vehicle-1',
  title: 'Engine oil change',
  type: ReminderType.Service,
  status: ReminderStatus.Upcoming,
  dueDate: now,
  repeatEveryKm: 10_000,
  repeatEveryMonths: 12,
  createdAt: now,
  updatedAt: now,
};

function linkedFor(stored: Reminder, reminderId: string | undefined, vehicleId: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(queryKeys.reminders.detail(stored.id), stored);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return renderHook(() => useLinkedReminder(reminderId, vehicleId), { wrapper }).result.current;
}

describe('useLinkedReminder', () => {
  it('gives the reminder on this vehicle and its own repeat rule', () => {
    expect(linkedFor(oil, reminderId, 'vehicle-1')).toEqual({
      reminder: oil,
      repeat: { km: 10_000, months: 12 },
    });
  });

  it('gives no rule for a reminder that does not repeat', () => {
    const once = { ...oil, repeatEveryKm: undefined, repeatEveryMonths: undefined };

    expect(linkedFor(once, reminderId, 'vehicle-1')).toEqual({ reminder: once, repeat: null });
  });

  it("ignores another vehicle's reminder, and no id at all", () => {
    expect(linkedFor(oil, reminderId, 'vehicle-2')).toEqual({ reminder: null, repeat: null });
    expect(linkedFor(oil, undefined, 'vehicle-1')).toEqual({ reminder: null, repeat: null });
  });
});
