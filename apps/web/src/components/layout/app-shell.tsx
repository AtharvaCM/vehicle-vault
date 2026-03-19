import type { PropsWithChildren } from 'react';

import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <AppSidebar />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
