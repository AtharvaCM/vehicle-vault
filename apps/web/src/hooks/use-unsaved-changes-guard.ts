import { useEffect, useRef } from 'react';

import { router } from '@/app/router';
import { confirm } from '@/components/shared/confirm';

type UseUnsavedChangesGuardOptions = {
  when: boolean;
  message?: string;
};

const DEFAULT_MESSAGE = 'You have changes that are not saved. Leave this page anyway?';

export function useUnsavedChangesGuard({
  when,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesGuardOptions) {
  const messageRef = useRef(message);
  const bypassRef = useRef(false);

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  useEffect(() => {
    if (!when) {
      bypassRef.current = false;
      return;
    }

    return router.history.block({
      enableBeforeUnload: () => !bypassRef.current,
      // Truthy blocks the navigation; the router waits for the answer.
      blockerFn: async () => {
        if (bypassRef.current) {
          return false;
        }

        const leave = await confirm({
          title: messageRef.current,
          confirmLabel: 'Leave',
          cancelLabel: 'Stay',
          destructive: true,
        });

        return !leave;
      },
    });
  }, [when]);

  function allowNextNavigation() {
    bypassRef.current = true;

    return () => {
      bypassRef.current = false;
    };
  }

  return {
    allowNextNavigation,
  };
}
