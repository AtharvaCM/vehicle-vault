import type { PropsWithChildren } from 'react';

import { AppLayout } from './app-layout';

export function AppShell({ children }: PropsWithChildren) {
  return <AppLayout>{children}</AppLayout>;
}
