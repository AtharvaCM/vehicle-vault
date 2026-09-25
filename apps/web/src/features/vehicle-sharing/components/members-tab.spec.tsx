import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { VehicleInvite, VehicleMember } from '@vehicle-vault/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const membersQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const invitesQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const createInvite = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const revokeInvite = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const resendInvite = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const updateRole = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
const removeMember = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));
const transferOwnership = vi.hoisted(() => ({ mutateAsync: vi.fn(), isPending: false }));

vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../hooks/use-sharing', () => ({
  useMembers: () => membersQuery.current,
  useInvites: () => invitesQuery.current,
  useCreateInvite: () => createInvite,
  useRevokeInvite: () => revokeInvite,
  useResendInvite: () => resendInvite,
  useUpdateMemberRole: () => updateRole,
  useRemoveMember: () => removeMember,
  useTransferOwnership: () => transferOwnership,
}));

import { MembersTab } from './members-tab';

const owner: VehicleMember = {
  id: 'member-owner',
  vehicleId: 'vehicle-1',
  userId: 'user-owner',
  role: 'owner' as VehicleMember['role'],
  email: 'asha@example.test',
  name: 'Asha',
  createdAt: '2026-08-01T00:00:00.000Z',
  isSelf: true,
};

const editor: VehicleMember = {
  id: 'member-editor',
  vehicleId: 'vehicle-1',
  userId: 'user-editor',
  role: 'editor' as VehicleMember['role'],
  email: 'priya@example.test',
  name: 'Priya',
  createdAt: '2026-08-02T00:00:00.000Z',
  isSelf: false,
};

const pendingInvite: VehicleInvite = {
  id: 'invite-1',
  vehicleId: 'vehicle-1',
  email: 'kiran@example.test',
  role: 'viewer' as VehicleInvite['role'],
  status: 'pending',
  expiresAt: '2026-10-02T00:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
  declinedAt: null,
  invitedByUserId: 'user-owner',
  createdAt: '2026-09-25T00:00:00.000Z',
};

describe('MembersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    membersQuery.current = { isLoading: false, isError: false, data: [owner, editor] };
    invitesQuery.current = { isLoading: false, isError: false, data: [] };
  });

  it('shows each member’s role with the same plain-words description used elsewhere', () => {
    render(<MembersTab currentUserRole="owner" vehicleId="vehicle-1" />);

    // The editor's line appears twice: once on their member row, once in the
    // invite dialog's role explanation below — both should say the same thing.
    expect(
      screen.getAllByText('Can also log services, fuel and papers.').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(
        'Full control — can invite, change roles, remove people and delete the vehicle.',
      ),
    ).toBeInTheDocument();
  });

  it('explains each role in plain words in the invite dialog, and names owner-only actions', () => {
    render(<MembersTab currentUserRole="owner" vehicleId="vehicle-1" />);

    expect(screen.getByText(/sees papers, history and reminders/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/can also log services, fuel and papers/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/can invite people, change roles, remove members or transfer ownership/i),
    ).toBeInTheDocument();
  });

  it('lists a pending invite with who and when, and lets the owner copy or revoke it', () => {
    invitesQuery.current = { isLoading: false, isError: false, data: [pendingInvite] };

    render(<MembersTab currentUserRole="owner" vehicleId="vehicle-1" />);

    expect(screen.getByText('kiran@example.test')).toBeInTheDocument();
    expect(screen.getByText(/invited/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
  });

  it('copies a fresh link for a pending invite, since the old one no longer works', async () => {
    invitesQuery.current = { isLoading: false, isError: false, data: [pendingInvite] };
    resendInvite.mutateAsync.mockResolvedValue({
      acceptUrl: 'https://app.test/vehicle-invites/fresh-token',
      emailSent: false,
      invite: pendingInvite,
    });
    const user = userEvent.setup();
    // userEvent.setup() installs its own clipboard stub, so spy on the method
    // it hands out rather than replacing navigator.clipboard beforehand.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<MembersTab currentUserRole="owner" vehicleId="vehicle-1" />);
    await user.click(screen.getByRole('button', { name: /copy link/i }));

    expect(resendInvite.mutateAsync).toHaveBeenCalledWith('invite-1');
    expect(writeText).toHaveBeenCalledWith('https://app.test/vehicle-invites/fresh-token');
  });

  it('does not show invite management to a non-owner', () => {
    membersQuery.current = { isLoading: false, isError: false, data: [owner, editor] };
    invitesQuery.current = { isLoading: false, isError: false, data: [] };

    render(<MembersTab currentUserRole="editor" vehicleId="vehicle-1" />);

    expect(screen.queryByRole('button', { name: 'Send invite' })).not.toBeInTheDocument();
  });
});
