import { render, screen } from '@testing-library/react';
import type { VehicleInviteCreated } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/toast', () => ({ appToast: { success: vi.fn(), error: vi.fn() } }));

import { InviteLinkPanel } from './members-tab';

const ACCEPT_URL = `https://app.test/vehicle-invites/${'a'.repeat(64)}`;

function created(emailSent: boolean): VehicleInviteCreated {
  return {
    acceptUrl: ACCEPT_URL,
    emailSent,
    invite: {
      id: '5f0c6a8e-3b1d-4c55-9f0e-1a2b3c4d5e6f',
      vehicleId: '6f0c6a8e-3b1d-4c55-9f0e-1a2b3c4d5e6f',
      email: 'priya@example.test',
      role: 'editor' as VehicleInviteCreated['invite']['role'],
      status: 'pending',
      expiresAt: '2026-09-30T00:00:00.000Z',
      acceptedAt: null,
      revokedAt: null,
      declinedAt: null,
      invitedByUserId: '7f0c6a8e-3b1d-4c55-9f0e-1a2b3c4d5e6f',
      createdAt: '2026-09-23T00:00:00.000Z',
    },
  };
}

describe('InviteLinkPanel', () => {
  it('hands over the link and says nothing was emailed when no email went out', () => {
    render(<InviteLinkPanel created={created(false)} onDone={vi.fn()} />);

    expect(screen.getByLabelText('Invite link')).toHaveValue(ACCEPT_URL);
    expect(
      screen.getByText(
        'Send this link to priya@example.test. Email isn’t set up, so nothing was sent.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /whatsapp/i })).toHaveAttribute(
      'href',
      `https://wa.me/?text=${encodeURIComponent(`Join my vehicle on Vehicle Vault: ${ACCEPT_URL}`)}`,
    );
  });

  it('says an email was sent only when the API confirms it', () => {
    render(<InviteLinkPanel created={created(true)} onDone={vi.fn()} />);

    expect(
      screen.getByText('Email sent to priya@example.test. You can also send them this link.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Invite link')).toHaveValue(ACCEPT_URL);
  });

  it('offers the share sheet first where it exists, then WhatsApp, then Copy link', () => {
    // jsdom has no navigator.share, matching most desktop browsers: WhatsApp
    // leads instead, but the order among the buttons that do render is fixed.
    render(<InviteLinkPanel created={created(false)} onDone={vi.fn()} />);

    const buttons = screen.getAllByRole('button').map((el) => el.textContent);
    const links = screen.getAllByRole('link').map((el) => el.textContent);
    expect(screen.queryByRole('button', { name: /^share$/i })).not.toBeInTheDocument();
    expect(links[0]).toMatch(/whatsapp/i);
    expect(buttons.find((text) => /copy link/i.test(text ?? ''))).toBeDefined();
    expect(buttons.find((text) => /^done$/i.test(text ?? ''))).toBeDefined();
  });
});
