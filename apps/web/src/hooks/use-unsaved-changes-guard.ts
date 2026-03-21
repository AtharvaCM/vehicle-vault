import { useEffect, useRef } from 'react';

import { router } from '@/app/router';

type UseUnsavedChangesGuardOptions = {
  when: boolean;
  message?: string;
};

const DEFAULT_MESSAGE = 'You have unsaved changes. Leave this page anyway?';

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
      blockerFn: () => {
        if (bypassRef.current) {
          return false;
        }

        return !window.confirm(messageRef.current);
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
