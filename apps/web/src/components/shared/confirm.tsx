import { useSyncExternalStore, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

export type ConfirmOptions = {
  /** The question, as a sentence: "Delete this fuel log?" */
  title: string;
  /** What happens if they go ahead, e.g. "It can't be undone." */
  description?: ReactNode;
  /** The verb on the button that goes ahead: "Delete", "Leave". Default "Continue". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Draws the confirm button in the late colour, for deleting or discarding. */
  destructive?: boolean;
};

type Request = ConfirmOptions & { id: number; resolve: (confirmed: boolean) => void };

const EMPTY: Request[] = [];
let requests: Request[] = EMPTY;
let lastId = 0;
const listeners = new Set<() => void>();

function publish(next: Request[]) {
  requests = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function settle(id: number, confirmed: boolean) {
  const request = requests.find((item) => item.id === id);
  if (!request) return;

  publish(requests.filter((item) => item.id !== id));
  request.resolve(confirmed);
}

/**
 * Asks the owner to confirm, in the app's own dialog rather than the
 * browser's: `if (await confirm({ title: 'Delete this fuel log?' })) …`.
 * Resolves true when they confirm and false when they cancel, press Escape or
 * tap outside. Requests made while one is open wait their turn.
 *
 * Needs `<ConfirmHost />` mounted once, which `AppProviders` does.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    lastId += 1;
    publish([...requests, { ...options, id: lastId, resolve }]);
  });
}

/**
 * Renders the pending `confirm()`. An alert dialog: focus moves into it, it is
 * announced with its title and description, Cancel takes the initial focus so
 * a stray Enter never deletes anything, and Escape cancels.
 */
export function ConfirmHost() {
  const queue = useSyncExternalStore(
    subscribe,
    () => requests,
    () => EMPTY,
  );
  const current = queue[0];

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open && current) settle(current.id, false);
      }}
      open={Boolean(current)}
    >
      {current ? (
        <AlertDialogContent key={current.id}>
          <AlertDialogHeader>
            <AlertDialogTitle>{current.title}</AlertDialogTitle>
            {current.description ? (
              <AlertDialogDescription>{current.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle(current.id, false)}>
              {current.cancelLabel ?? 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({
                variant: current.destructive ? 'destructive' : 'default',
              })}
              onClick={() => settle(current.id, true)}
            >
              {current.confirmLabel ?? 'Continue'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}
