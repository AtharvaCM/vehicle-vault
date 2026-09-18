import { LayoutDashboard, RotateCw, TriangleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';

type RecoveryScreenProps = {
  onGoToDashboard: () => void;
  /** Defaults to a full page reload, which clears whatever state the error came from. */
  onReload?: () => void;
};

/**
 * What replaces a page that threw while rendering. Layout-neutral on purpose:
 * inside the app shell it sits in the content area with the sidebar still
 * there to navigate away with, and outside it stands on its own.
 */
export function RecoveryScreen({
  onGoToDashboard,
  onReload = () => window.location.reload(),
}: RecoveryScreenProps) {
  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/60">
        <TriangleAlert className="h-6 w-6 text-amber-600" />
      </div>
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="text-sm leading-6 text-slate-600">
        This page hit an error it could not recover from. Reloading usually fixes it; if it keeps
        happening, the dashboard is a safe place to start again.
      </p>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button onClick={onReload} type="button">
          <RotateCw className="mr-2 h-4 w-4" />
          Reload
        </Button>
        <Button onClick={onGoToDashboard} type="button" variant="outline">
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
