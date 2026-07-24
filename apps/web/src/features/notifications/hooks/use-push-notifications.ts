import { useCallback, useEffect, useState } from 'react';

import { getPushPublicKey, subscribePush, unsubscribePush } from '../api/push';

export type PushStatus =
  | 'unsupported' // browser has no push API
  | 'unavailable' // backend has no VAPID keys configured
  | 'denied' // user blocked notifications at the browser level
  | 'off'
  | 'on'
  | 'loading';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Browser push subscription state for the current device. Registers
 * `/sw.js`, mirrors the existing PushSubscription (if any), and exposes
 * enable/disable that sync the endpoint with the API.
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isSupported()) {
        setStatus('unsupported');
        return;
      }
      try {
        const { available } = await getPushPublicKey();
        if (cancelled) return;
        if (!available) {
          setStatus('unavailable');
          return;
        }
        if (Notification.permission === 'denied') {
          setStatus('denied');
          return;
        }
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setStatus(subscription ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    }

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setStatus('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        return false;
      }
      const { publicKey } = await getPushPublicKey();
      if (!publicKey) {
        setStatus('unavailable');
        return false;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      await subscribePush({
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent,
      });
      setStatus('on');
      return true;
    } catch {
      setStatus('off');
      return false;
    }
  }, []);

  const disable = useCallback(async () => {
    setStatus('loading');
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus('off');
      return true;
    } catch {
      setStatus('on');
      return false;
    }
  }, []);

  return { status, enable, disable };
}
