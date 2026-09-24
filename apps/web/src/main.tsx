import React from 'react';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { captureInstallPrompt } from '@/features/pwa/install-prompt';
import { initClarity } from '@/lib/monitoring/init-clarity';
import { initErrorReporting } from '@/lib/monitoring/init-error-reporting';
import { installZodErrorMap } from '@/lib/validation/zod-error-map';
import { queryClient } from '@/lib/query/query-client';
import { mountApp } from '@/prerender/mount-app';
import { startThemeSync } from '@/lib/theme';
import '@/styles/globals.css';

initErrorReporting();
initClarity();
// Before any form validates: no raw Zod message should ever reach a user.
installZodErrorMap();
// Before the first render: the browser can offer installation straight away.
captureInstallPrompt();
// The inline script in index.html set the theme before the first paint; from
// here the page follows the system (on System) and choices made in other tabs.
startThemeSync();

// The worker precaches the app shell so it opens instantly and offline, and it
// is the same /sw.js push notifications use. Production only: in dev it would
// serve cached modules over HMR. Loaded lazily so the dev server never requests
// the module: finding its dependency mid-session makes Vite reload every open
// page, which is what a cold e2e run would hit.
if (import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}

// A prerendered public catalog page is hydrated in place; everything else is a
// plain client render. The prerender renders this same tree.
mountApp(
  document.getElementById('root')!,
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>,
  { router, queryClient },
);
