import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { captureInstallPrompt, resetInstallPromptForTests } from '../install-prompt';
import { InstallAppCard } from './install-app-card';

/** What Chrome fires when the page meets its install criteria. */
function offerInstallation(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('InstallAppCard', () => {
  beforeAll(() => {
    captureInstallPrompt();
  });

  beforeEach(() => {
    act(() => resetInstallPromptForTests());
  });

  it('stays hidden where the browser offers no installation', () => {
    render(<InstallAppCard />);

    // Safari and Firefox never fire the event; nor does an installed app.
    expect(screen.queryByRole('region', { name: 'Install Vehicle Vault' })).not.toBeInTheDocument();
  });

  it("offers installation once the browser does, holding back the browser's own banner", () => {
    render(<InstallAppCard />);

    const event = offerInstallation();

    expect(screen.getByRole('region', { name: 'Install Vehicle Vault' })).toBeInTheDocument();
    expect(event.defaultPrevented).toBe(true);
  });

  it('installs through the browser prompt, then gets out of the way', async () => {
    const user = userEvent.setup();
    render(<InstallAppCard />);
    const event = offerInstallation('accepted');

    await user.click(screen.getByRole('button', { name: 'Install' }));

    expect(event.prompt).toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Install Vehicle Vault' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('puts the offer away for good on "Not now", even when the browser asks again', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<InstallAppCard />);
    offerInstallation();

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Install Vehicle Vault' })).not.toBeInTheDocument();

    // A later visit: the browser offers again, the dismissal on this device holds.
    unmount();
    render(<InstallAppCard />);
    offerInstallation();
    expect(screen.queryByRole('region', { name: 'Install Vehicle Vault' })).not.toBeInTheDocument();
  });

  it('treats declining the browser prompt as a dismissal', async () => {
    const user = userEvent.setup();
    render(<InstallAppCard />);
    offerInstallation('dismissed');

    await user.click(screen.getByRole('button', { name: 'Install' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Install Vehicle Vault' }),
      ).not.toBeInTheDocument(),
    );
    offerInstallation();
    expect(screen.queryByRole('region', { name: 'Install Vehicle Vault' })).not.toBeInTheDocument();
  });

  it('disappears when the app is installed from the browser menu instead', () => {
    render(<InstallAppCard />);
    offerInstallation();

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByRole('region', { name: 'Install Vehicle Vault' })).not.toBeInTheDocument();
  });
});
