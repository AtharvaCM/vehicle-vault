import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useInstallPrompt } from '../install-prompt';

/**
 * Offers installation where the browser allows it, once there is a garage worth
 * coming back to. An installed app opens straight from the home screen, and
 * with the shell precached it opens at a fuel pump with no signal. "Not now"
 * puts the offer away on this device for good.
 */
export function InstallAppCard() {
  const { canInstall, install, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <Card
      aria-label="Install Vehicle Vault"
      className="flex flex-col gap-3 border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="region"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
          <Download aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-fg">Install Vehicle Vault</p>
          <p className="text-sm text-fg-2">
            Open it from your home screen in a tap, even where there&apos;s no signal.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button onClick={dismiss} size="sm" variant="ghost">
          Not now
        </Button>
        <Button onClick={() => void install()} size="sm">
          Install
        </Button>
      </div>
    </Card>
  );
}
