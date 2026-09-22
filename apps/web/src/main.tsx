import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppProviders } from '@/app/providers';
import { captureInstallPrompt } from '@/features/pwa/install-prompt';
import { initClarity } from '@/lib/monitoring/init-clarity';
import { initErrorReporting } from '@/lib/monitoring/init-error-reporting';
import '@/styles/globals.css';

initErrorReporting();
initClarity();
// Before the first render: the browser can offer installation straight away.
captureInstallPrompt();

// The worker precaches the app shell so it opens instantly and offline, and it
// is the same /sw.js push notifications use. Production only: in dev it would
// serve cached modules over HMR. Loaded lazily so the dev server never requests
// the module: finding its dependency mid-session makes Vite reload every open
// page, which is what a cold e2e run would hit.
if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>,
);
