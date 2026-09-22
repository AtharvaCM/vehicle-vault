import { useCallback, useSyncExternalStore } from 'react';

import { isStandalone } from './platform';

/** Chrome's install event; not in the DOM typings. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'vehicle-vault.install-offer-dismissed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    // A private window: the offer comes back next visit, which is harmless.
  }
}

/**
 * Holds the browser's install event instead of letting it show its own banner
 * the moment the page loads, so the app can offer installation once someone has
 * something worth coming back to. Call before React mounts: the event can fire
 * before the first render.
 */
export function captureInstallPrompt(target: Window = window) {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  target.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function snapshot(): boolean {
  return deferredPrompt !== null && !readDismissed() && !isStandalone();
}

function subscribe(subscriber: () => void) {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

/**
 * Whether installation can be offered right now, and the two answers to the
 * offer. `canInstall` is false when the browser has not offered installation
 * (Safari, Firefox, already installed), once the app is installed, and after
 * the offer is dismissed on this device.
 */
export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(subscribe, snapshot, () => false);

  const install = useCallback(async () => {
    const promptEvent = deferredPrompt;
    if (!promptEvent) return 'unavailable' as const;

    // The browser allows one prompt per event, whatever the answer.
    deferredPrompt = null;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'dismissed') writeDismissed();
    notify();
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    writeDismissed();
    notify();
  }, []);

  return { canInstall, install, dismiss };
}

/** Test seam: forget the held event and any dismissal. */
export function resetInstallPromptForTests() {
  deferredPrompt = null;
  try {
    window.localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Nothing to reset.
  }
  notify();
}
