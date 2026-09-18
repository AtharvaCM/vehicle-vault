import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ current: { user: { emailVerified: true } } }));

vi.mock('@/features/auth/hooks/use-auth', () => ({ useAuth: () => auth.current }));
vi.mock('./sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('./topbar', () => ({ Topbar: () => <header /> }));
vi.mock('@/features/auth/components/email-verification-screen', () => ({
  EmailVerificationScreen: () => <p>verify your email</p>,
}));

import { AppLayout } from './app-layout';

/**
 * Clarity is only safe to load because everything signed-in is masked in its
 * recordings. If this attribute goes, registration and policy numbers get
 * recorded — so it is asserted, not assumed.
 */
describe('AppLayout', () => {
  it('masks the signed-in app in session recordings', () => {
    auth.current = { user: { emailVerified: true } };
    const { container } = render(<AppLayout>content</AppLayout>);

    expect(container.firstElementChild).toHaveAttribute('data-clarity-mask', 'True');
  });

  it('masks the verification wall too, which shows the account email', () => {
    auth.current = { user: { emailVerified: false } };
    const { container } = render(<AppLayout>content</AppLayout>);

    expect(container.firstElementChild).toHaveAttribute('data-clarity-mask', 'True');
  });
});
