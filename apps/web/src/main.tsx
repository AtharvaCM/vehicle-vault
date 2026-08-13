import React from 'react';
import ReactDOM from 'react-dom/client';

import { AppProviders } from '@/app/providers';
import { initErrorReporting } from '@/lib/monitoring/init-error-reporting';
import '@/styles/globals.css';

initErrorReporting();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>,
);
