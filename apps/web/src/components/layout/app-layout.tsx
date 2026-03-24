import type { PropsWithChildren } from 'react';

import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export function AppLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50/70 text-foreground">
      <a
        className="sr-only left-4 top-4 z-50 rounded-lg bg-slate-950 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:absolute focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950"
        href="#main-content"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
