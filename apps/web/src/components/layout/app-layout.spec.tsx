import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = { emailVerified: boolean; emailVerificationDueAt?: string | null };

const auth = vi.hoisted(() => ({
  current: {
    user: { emailVerified: true, emailVerificationDueAt: null } as TestUser,
    refreshUser: vi.fn(),
  },
}));

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('./sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('./topbar', () => ({ Topbar: () => <header /> }));
vi.mock('./bottom-nav', () => ({ BottomNav: () => <nav aria-label="Primary" /> }));
vi.mock('@/features/auth/components/email-verification-screen', () => ({
  EmailVerificationScreen: () => <p>verify your email</p>,
}));
vi.mock('@/features/auth/components/email-verification-banner', () => ({
  EmailVerificationBanner: ({ daysLeft }: { daysLeft: number }) => (
    <p>verification banner, {daysLeft} days left</p>
  ),
}));

import { AppLayout } from './app-layout';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-19T10:00:00.000Z');

function signInAs(user: TestUser) {
  auth.current = { user, refreshUser: vi.fn() };
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Clarity is only safe to load because everything signed-in is masked in its
   * recordings. If this attribute goes, registration and policy numbers get
   * recorded — so it is asserted, not assumed.
   */
  it('masks the signed-in app in session recordings', () => {
    signInAs({ emailVerified: true, emailVerificationDueAt: null });
    const { container } = render(<AppLayout>content</AppLayout>);

    expect(container.firstElementChild).toHaveAttribute('data-clarity-mask', 'True');
  });

  it('masks the verification wall too, which shows the account email', () => {
    signInAs({ emailVerified: false, emailVerificationDueAt: now.toISOString() });
    const { container } = render(<AppLayout>content</AppLayout>);

    expect(screen.getByText('verify your email')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-clarity-mask', 'True');
  });

  it('lets an unverified account inside its week use the app, with the banner', () => {
    signInAs({
      emailVerified: false,
      emailVerificationDueAt: new Date(now.getTime() + 5 * DAY_MS).toISOString(),
    });
    render(<AppLayout>garage content</AppLayout>);

    expect(screen.getByText('garage content')).toBeInTheDocument();
    expect(screen.getByText('verification banner, 5 days left')).toBeInTheDocument();
    expect(screen.queryByText('verify your email')).not.toBeInTheDocument();
  });

  it('puts the wall up once the week is over', () => {
    signInAs({
      emailVerified: false,
      emailVerificationDueAt: new Date(now.getTime() - DAY_MS).toISOString(),
    });
    render(<AppLayout>garage content</AppLayout>);

    expect(screen.getByText('verify your email')).toBeInTheDocument();
    expect(screen.queryByText('garage content')).not.toBeInTheDocument();
  });

  it('shows a verified account neither banner nor wall', () => {
    signInAs({ emailVerified: true, emailVerificationDueAt: null });
    render(<AppLayout>garage content</AppLayout>);

    expect(screen.getByText('garage content')).toBeInTheDocument();
    expect(screen.queryByText(/verification banner/)).not.toBeInTheDocument();
    expect(screen.queryByText('verify your email')).not.toBeInTheDocument();
  });

  it('re-reads an unverified account when its tab comes back into view', () => {
    signInAs({
      emailVerified: false,
      emailVerificationDueAt: new Date(now.getTime() + 5 * DAY_MS).toISOString(),
    });
    render(<AppLayout>garage content</AppLayout>);

    fireEvent.focus(window);
    // Focus and visibility arrive together on return; one request covers both.
    fireEvent(document, new Event('visibilitychange'));

    expect(auth.current.refreshUser).toHaveBeenCalledTimes(1);
  });

  it('re-reads the account behind the wall as well', () => {
    signInAs({ emailVerified: false, emailVerificationDueAt: now.toISOString() });
    render(<AppLayout>garage content</AppLayout>);

    fireEvent.focus(window);

    expect(auth.current.refreshUser).toHaveBeenCalledTimes(1);
  });

  it('leaves a verified account alone on return', () => {
    signInAs({ emailVerified: true, emailVerificationDueAt: null });
    render(<AppLayout>garage content</AppLayout>);

    fireEvent.focus(window);

    expect(auth.current.refreshUser).not.toHaveBeenCalled();
  });
  it('leaves room under the page for the bottom bar, and only below md', () => {
    signInAs({ emailVerified: true, emailVerificationDueAt: null });
    render(<AppLayout>content</AppLayout>);

    // The bar is fixed over the page on a phone; without this padding it would
    // sit on top of the last row of every list.
    const main = screen.getByRole('main');
    expect(main).toHaveClass('pb-[calc(4.5rem+env(safe-area-inset-bottom))]', 'md:pb-0');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });
});
