import type { ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ConfirmActionDialogProps = {
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel: string;
  isPending?: boolean;
  onConfirm: () => Promise<void> | void;
  triggerVariant?: React.ComponentProps<typeof Button>['variant'];
  triggerSize?: React.ComponentProps<typeof Button>['size'];
  triggerIcon?: ReactNode;
};

export function ConfirmActionDialog({
  title,
  description,
  triggerLabel,
  confirmLabel,
  isPending = false,
  onConfirm,
  triggerVariant = 'secondary',
  triggerSize = 'sm',
  triggerIcon,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={triggerSize} variant={triggerVariant}>
          {triggerIcon}
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {isPending ? 'Working...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
